'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, test } = require('node:test');
const { JSDOM } = require('jsdom');

const {
  formatPercentage,
  getPopularityLevel,
  getTier,
  parseMetric
} = require('../content.js');

const contentScript = fs.readFileSync(
  path.join(__dirname, '..', 'content.js'),
  'utf8'
);

function trackMarkup({ id, likes, plays, title = `${plays} plays` }) {
  const titleAttribute = title === null ? '' : ` title="${title}"`;

  return `
    <li class="soundList__item" data-track-id="${id}">
      <div class="sc-button-group">
        <button class="sc-button-like">
          <span class="sc-button-label">${likes}</span>
        </button>
      </div>
      <ul>
        <li class="sc-ministats-item"${titleAttribute}>
          <span class="sc-ministats-plays">${plays}</span>
        </li>
      </ul>
    </li>
  `;
}

function startExtension(markup) {
  const dom = new JSDOM(`<!doctype html><body>${markup}</body>`, {
    runScripts: 'outside-only',
    url: 'https://soundcloud.com/search?q=test'
  });

  dom.window.eval(contentScript);
  return dom;
}

function waitForScan(window, milliseconds = 180) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function trackOrder(list) {
  return [...list.children].map((item) => item.dataset.trackId);
}

describe('metric calculations', () => {
  test('parses exact counts with common locale grouping', () => {
    const cases = [
      ['1,234 plays', 1_234],
      ['1.234 plays', 1_234],
      ['1 234 plays', 1_234],
      ['1\u00a0234 plays', 1_234],
      ['1,234,567 plays', 1_234_567],
      ['1.234.567 plays', 1_234_567]
    ];

    for (const [source, value] of cases) {
      assert.deepEqual(parseMetric(source), {
        value,
        approximate: false
      });
    }
  });

  test('parses abbreviated counts with either decimal convention', () => {
    const cases = [
      ['10.1K', 10_100],
      ['10,1K', 10_100],
      ['1,234.5K', 1_234_500],
      ['1.234,5K', 1_234_500],
      ['2M', 2_000_000],
      ['1.25B', 1_250_000_000]
    ];

    for (const [source, value] of cases) {
      assert.deepEqual(parseMetric(source), {
        value,
        approximate: true
      });
    }
  });

  test('rejects missing and malformed values', () => {
    assert.equal(parseMetric(), null);
    assert.equal(parseMetric(''), null);
    assert.equal(parseMetric('not available'), null);
  });

  test('formats exact and approximate percentages', () => {
    assert.deepEqual(
      formatPercentage(
        { value: 3, approximate: false },
        { value: 100, approximate: false }
      ),
      { percentage: 3, label: '3.00%' }
    );
    assert.deepEqual(
      formatPercentage(
        { value: 3, approximate: true },
        { value: 10, approximate: false }
      ),
      { percentage: 30, label: '≈30.0%' }
    );
  });

  test('uses the documented tier and popularity boundaries', () => {
    assert.equal(getTier(1.49), 'low');
    assert.equal(getTier(1.5), 'average');
    assert.equal(getTier(3), 'good');
    assert.equal(getTier(5), 'high');
    assert.equal(getPopularityLevel(999_999), 'normal');
    assert.equal(getPopularityLevel(1_000_000), 'popular');
    assert.equal(getPopularityLevel(10_000_000), 'very-popular');
  });
});

describe('content script behavior', () => {
  test('renders an accessible badge and sortable value', () => {
    const dom = startExtension(trackMarkup({
      id: 'track-a',
      likes: '100',
      plays: '2K',
      title: '2.000 plays'
    }));

    try {
      const track = dom.window.document.querySelector('[data-track-id="track-a"]');
      const badge = track.querySelector('.sc-like-ratio-extension');

      assert.equal(badge.textContent, '5.00%');
      assert.equal(badge.getAttribute('role'), 'status');
      assert.equal(badge.getAttribute('aria-label'), 'Like percentage');
      assert.equal(badge.dataset.tier, 'high');
      assert.equal(badge.dataset.lowSample, 'false');
      assert.equal(badge.dataset.popularity, 'normal');
      assert.match(badge.title, /2,000 plays/);
      assert.equal(track.dataset.scLikeRatioValue, '5');
    } finally {
      dom.window.close();
    }
  });

  test('marks a ratio approximate when a displayed metric is abbreviated', () => {
    const dom = startExtension(trackMarkup({
      id: 'track-a',
      likes: '10,1K',
      plays: '250K',
      title: '250.000 plays'
    }));

    try {
      const badge = dom.window.document.querySelector(
        '.sc-like-ratio-extension'
      );
      assert.equal(badge.textContent, '≈4.04%');
      assert.equal(badge.dataset.tier, 'good');
    } finally {
      dom.window.close();
    }
  });

  test('updates once and settles after a SoundCloud metric mutation', async () => {
    const dom = startExtension(trackMarkup({
      id: 'track-a',
      likes: '100',
      plays: '2,000'
    }));

    try {
      const document = dom.window.document;
      const badge = document.querySelector('.sc-like-ratio-extension');
      const badgeMutations = [];
      const observer = new dom.window.MutationObserver((mutations) => {
        badgeMutations.push(...mutations);
      });
      observer.observe(badge, {
        childList: true,
        characterData: true,
        subtree: true
      });

      document.querySelector('.sc-button-label').textContent = '120';
      await waitForScan(dom.window, 450);
      observer.disconnect();

      assert.equal(badge.textContent, '6.00%');
      assert.equal(badgeMutations.length, 1);
      assert.equal(document.querySelectorAll(
        '.sc-like-ratio-extension'
      ).length, 1);
    } finally {
      dom.window.close();
    }
  });

  test('removes stale badge and sorting state when metrics disappear', async () => {
    const dom = startExtension(trackMarkup({
      id: 'track-a',
      likes: '100',
      plays: '2,000'
    }));

    try {
      const document = dom.window.document;
      const track = document.querySelector('[data-track-id="track-a"]');
      document.querySelector('.sc-ministats-plays').remove();
      await waitForScan(dom.window);

      assert.equal(track.querySelector('.sc-like-ratio-extension'), null);
      assert.equal(track.hasAttribute('data-sc-like-ratio-value'), false);
    } finally {
      dom.window.close();
    }
  });

  test('sorts each list, adds new tracks to the sort, and restores order', async () => {
    const firstList = `
      <ul id="first-list">
        ${trackMarkup({ id: 'a', likes: '10', plays: '1,000' })}
        ${trackMarkup({ id: 'b', likes: '50', plays: '1,000' })}
        ${trackMarkup({ id: 'c', likes: '30', plays: '1,000' })}
        ${trackMarkup({ id: 'invalid', likes: '-', plays: '1,000' })}
      </ul>
    `;
    const secondList = `
      <ul id="second-list">
        ${trackMarkup({ id: 'x', likes: '10', plays: '100' })}
        ${trackMarkup({ id: 'y', likes: '20', plays: '100' })}
      </ul>
    `;
    const dom = startExtension(firstList + secondList);

    try {
      const document = dom.window.document;
      const first = document.querySelector('#first-list');
      const second = document.querySelector('#second-list');
      const button = document.querySelector('.sc-like-ratio-sort-control');

      button.click();
      assert.deepEqual(trackOrder(first), ['b', 'c', 'a', 'invalid']);
      assert.deepEqual(trackOrder(second), ['y', 'x']);

      first.insertAdjacentHTML('beforeend', trackMarkup({
        id: 'new',
        likes: '100',
        plays: '1,000'
      }));
      await waitForScan(dom.window, 320);

      assert.deepEqual(
        trackOrder(first),
        ['new', 'b', 'c', 'a', 'invalid']
      );

      button.click();
      assert.deepEqual(
        trackOrder(first),
        ['a', 'b', 'c', 'invalid', 'new']
      );
      assert.deepEqual(trackOrder(second), ['x', 'y']);
    } finally {
      dom.window.close();
    }
  });
});
