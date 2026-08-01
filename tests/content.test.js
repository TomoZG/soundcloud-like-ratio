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

function setMinimumPlays(document, value) {
  const input = document.querySelector('#sc-like-ratio-minimum-plays');
  input.value = value;
  input.dispatchEvent(new document.defaultView.Event('blur'));
  return input;
}

function setMinimumLikes(document, value) {
  const input = document.querySelector('#sc-like-ratio-minimum-likes');
  input.value = value;
  input.dispatchEvent(new document.defaultView.Event('blur'));
  return input;
}

function setUnknownCountMode(document, value) {
  const select = document.querySelector('#sc-like-ratio-unknown-counts');
  select.value = value;
  select.dispatchEvent(new document.defaultView.Event('change'));
  return select;
}

function setSortOrder(document, value) {
  const select = document.querySelector('#sc-like-ratio-sort-order');
  select.value = value;
  select.dispatchEvent(new document.defaultView.Event('change'));
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
      assert.equal(track.dataset.scLikeRatioPlays, '2000');
      assert.equal(track.dataset.scLikeRatioLikes, '100');
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

  test('updates when only the exact play-count title changes', async () => {
    const dom = startExtension(trackMarkup({
      id: 'track-a',
      likes: '100',
      plays: '2K',
      title: '2,000 plays'
    }));

    try {
      const document = dom.window.document;
      const track = document.querySelector('[data-track-id="track-a"]');
      const badge = track.querySelector('.sc-like-ratio-extension');

      track.querySelector('.sc-ministats-item').title = '4,000 plays';
      await waitForScan(dom.window);

      assert.equal(badge.textContent, '2.50%');
      assert.equal(track.dataset.scLikeRatioPlays, '4000');
      assert.equal(track.dataset.scLikeRatioValue, '2.5');
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
      assert.equal(track.hasAttribute('data-sc-like-ratio-plays'), false);
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
      const button = document.querySelector('.sc-like-ratio-control-button');

      setSortOrder(document, 'ratio');
      assert.deepEqual(trackOrder(first), ['b', 'c', 'a', 'invalid']);
      assert.deepEqual(trackOrder(second), ['y', 'x']);
      assert.equal(button.dataset.active, 'true');

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

      setSortOrder(document, 'original');
      assert.deepEqual(
        trackOrder(first),
        ['a', 'b', 'c', 'invalid', 'new']
      );
      assert.deepEqual(trackOrder(second), ['x', 'y']);
    } finally {
      dom.window.close();
    }
  });

  test('opens an accessible panel and closes it with Done and Escape', () => {
    const dom = startExtension(trackMarkup({
      id: 'track-a',
      likes: '-',
      plays: '2,000'
    }));

    try {
      const document = dom.window.document;
      const button = document.querySelector('.sc-like-ratio-control-button');
      const panel = document.querySelector('.sc-like-ratio-panel');
      const input = document.querySelector('#sc-like-ratio-minimum-plays');

      assert.equal(document.querySelector('.sc-like-ratio-controls').hidden, false);
      assert.equal(panel.hidden, true);
      assert.equal(button.getAttribute('aria-expanded'), 'false');

      button.click();
      assert.equal(panel.hidden, false);
      assert.equal(button.getAttribute('aria-expanded'), 'true');
      assert.equal(document.activeElement, input);

      document.body.dispatchEvent(new dom.window.MouseEvent('click', {
        bubbles: true
      }));
      assert.equal(panel.hidden, true);

      button.click();

      document.querySelector('.sc-like-ratio-done').click();
      assert.equal(panel.hidden, true);
      assert.equal(document.activeElement, button);

      button.click();
      document.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      }));
      assert.equal(panel.hidden, true);
      assert.equal(document.activeElement, button);
    } finally {
      dom.window.close();
    }
  });

  test('hides only unknown counts required by active filters by default', () => {
    const list = `
      <ul id="tracks">
        ${trackMarkup({
          id: 'unknown-plays',
          likes: '10',
          plays: 'not available',
          title: null
        })}
        ${trackMarkup({ id: 'unknown-likes', likes: '-', plays: '2,000' })}
        ${trackMarkup({ id: 'known-zero', likes: '0', plays: '0' })}
      </ul>
    `;
    const dom = startExtension(list);

    try {
      const document = dom.window.document;
      const track = (id) => document.querySelector(`[data-track-id="${id}"]`);
      const isFiltered = (id) => track(id).classList.contains(
        'sc-like-ratio-filtered'
      );
      const unknownCounts = document.querySelector(
        '#sc-like-ratio-unknown-counts'
      );

      assert.equal(unknownCounts.value, 'hide');
      assert.equal(isFiltered('unknown-plays'), false);
      assert.equal(isFiltered('unknown-likes'), false);
      assert.equal(track('known-zero').dataset.scLikeRatioPlays, '0');
      assert.equal(track('known-zero').dataset.scLikeRatioLikes, '0');

      setUnknownCountMode(document, 'show');
      assert.equal(
        document.querySelector('.sc-like-ratio-control-button').dataset.active,
        'true'
      );
      setUnknownCountMode(document, 'hide');
      assert.equal(
        document.querySelector('.sc-like-ratio-control-button').dataset.active,
        'false'
      );

      setMinimumPlays(document, '0');
      assert.equal(isFiltered('unknown-plays'), true);
      assert.equal(isFiltered('unknown-likes'), false);
      assert.equal(isFiltered('known-zero'), false);

      setMinimumPlays(document, '');
      setMinimumLikes(document, '0');
      assert.equal(isFiltered('unknown-plays'), false);
      assert.equal(isFiltered('unknown-likes'), true);
      assert.equal(isFiltered('known-zero'), false);

      setMinimumPlays(document, '0');
      assert.equal(isFiltered('unknown-plays'), true);
      assert.equal(isFiltered('unknown-likes'), true);
      assert.equal(isFiltered('known-zero'), false);

      setUnknownCountMode(document, 'show');
      assert.equal(isFiltered('unknown-plays'), false);
      assert.equal(isFiltered('unknown-likes'), false);
      assert.match(
        document.querySelector('.sc-like-ratio-control-button').getAttribute(
          'aria-label'
        ),
        /show tracks with unknown filtered counts/
      );
    } finally {
      dom.window.close();
    }
  });

  test('filters plays inclusively and can show tracks with unknown plays', () => {
    const list = `
      <ul id="tracks">
        ${trackMarkup({ id: 'below', likes: '10', plays: '999' })}
        ${trackMarkup({ id: 'boundary', likes: '10', plays: '1,000' })}
        ${trackMarkup({ id: 'invalid-ratio', likes: '-', plays: '2,000' })}
        ${trackMarkup({
          id: 'unknown',
          likes: '10',
          plays: 'not available',
          title: null
        })}
      </ul>
    `;
    const dom = startExtension(list);

    try {
      const document = dom.window.document;
      setUnknownCountMode(document, 'show');
      const input = setMinimumPlays(document, '1000');
      const track = (id) => document.querySelector(`[data-track-id="${id}"]`);

      assert.equal(track('below').classList.contains(
        'sc-like-ratio-filtered'
      ), true);
      assert.equal(track('boundary').classList.contains(
        'sc-like-ratio-filtered'
      ), false);
      assert.equal(track('invalid-ratio').classList.contains(
        'sc-like-ratio-filtered'
      ), false);
      assert.equal(track('invalid-ratio').dataset.scLikeRatioPlays, '2000');
      assert.equal(track('invalid-ratio').hasAttribute(
        'data-sc-like-ratio-value'
      ), false);
      assert.equal(track('unknown').classList.contains(
        'sc-like-ratio-filtered'
      ), false);
      assert.equal(input.getAttribute('aria-invalid'), 'false');
      assert.match(
        document.querySelector('.sc-like-ratio-control-button').getAttribute(
          'aria-label'
        ),
        /at least 1,000 plays/
      );
    } finally {
      dom.window.close();
    }
  });

  test('filters likes inclusively and can show tracks with unknown likes', () => {
    const list = `
      <ul id="tracks">
        ${trackMarkup({ id: 'below', likes: '9', plays: '2,000' })}
        ${trackMarkup({ id: 'boundary', likes: '10', plays: '1,000' })}
        ${trackMarkup({ id: 'low-plays', likes: '100', plays: '999' })}
        ${trackMarkup({ id: 'approximate', likes: '10.1K', plays: '250K' })}
        ${trackMarkup({ id: 'unknown-likes', likes: '-', plays: '2,000' })}
        ${trackMarkup({
          id: 'unknown-plays',
          likes: '100',
          plays: 'not available',
          title: null
        })}
      </ul>
    `;
    const dom = startExtension(list);

    try {
      const document = dom.window.document;
      const track = (id) => document.querySelector(`[data-track-id="${id}"]`);
      setUnknownCountMode(document, 'show');
      setMinimumPlays(document, '1000');
      setMinimumLikes(document, '10');

      assert.equal(track('below').classList.contains(
        'sc-like-ratio-filtered'
      ), true);
      assert.equal(track('boundary').classList.contains(
        'sc-like-ratio-filtered'
      ), false);
      assert.equal(track('low-plays').classList.contains(
        'sc-like-ratio-filtered'
      ), true);
      assert.equal(track('approximate').classList.contains(
        'sc-like-ratio-filtered'
      ), false);
      assert.equal(track('approximate').dataset.scLikeRatioLikes, '10100');
      assert.equal(track('unknown-likes').classList.contains(
        'sc-like-ratio-filtered'
      ), false);
      assert.equal(track('unknown-likes').hasAttribute(
        'data-sc-like-ratio-likes'
      ), false);
      assert.equal(track('unknown-plays').classList.contains(
        'sc-like-ratio-filtered'
      ), false);
      assert.match(
        document.querySelector('.sc-like-ratio-control-button').getAttribute(
          'aria-label'
        ),
        /at least 10 likes/
      );

    } finally {
      dom.window.close();
    }
  });

  test('retains the applied threshold after invalid input and Reset clears settings', () => {
    const list = `
      <ul id="tracks">
        ${trackMarkup({ id: 'low', likes: '10', plays: '500' })}
        ${trackMarkup({ id: 'high', likes: '20', plays: '2,000' })}
      </ul>
    `;
    const dom = startExtension(list);

    try {
      const document = dom.window.document;
      const low = document.querySelector('[data-track-id="low"]');
      const input = setMinimumPlays(document, '1000');
      const likesInput = setMinimumLikes(document, '10');
      const unknownCounts = setUnknownCountMode(document, 'show');

      assert.equal(low.classList.contains('sc-like-ratio-filtered'), true);

      input.value = '-1';
      input.dispatchEvent(new dom.window.Event('blur'));
      assert.equal(input.getAttribute('aria-invalid'), 'true');
      assert.equal(low.classList.contains('sc-like-ratio-filtered'), true);

      likesInput.value = '1.5';
      likesInput.dispatchEvent(new dom.window.Event('blur'));
      assert.equal(likesInput.getAttribute('aria-invalid'), 'true');

      setSortOrder(document, 'ratio');
      document.querySelector('.sc-like-ratio-reset').click();
      assert.equal(input.value, '');
      assert.equal(likesInput.value, '');
      assert.equal(unknownCounts.value, 'hide');
      assert.equal(input.getAttribute('aria-invalid'), 'false');
      assert.equal(likesInput.getAttribute('aria-invalid'), 'false');
      assert.equal(low.classList.contains('sc-like-ratio-filtered'), false);
      assert.equal(
        document.querySelector('#sc-like-ratio-sort-order').value,
        'original'
      );
      assert.equal(
        document.querySelector('.sc-like-ratio-control-button').dataset.active,
        'false'
      );
    } finally {
      dom.window.close();
    }
  });

  test('applies active filtering and sorting to dynamically loaded tracks', async () => {
    const list = `
      <ul id="tracks">
        ${trackMarkup({ id: 'a', likes: '10', plays: '2,000' })}
        ${trackMarkup({ id: 'b', likes: '100', plays: '2,000' })}
      </ul>
    `;
    const dom = startExtension(list);

    try {
      const document = dom.window.document;
      const tracks = document.querySelector('#tracks');
      setMinimumPlays(document, '1000');
      setSortOrder(document, 'ratio');

      tracks.insertAdjacentHTML('beforeend', trackMarkup({
        id: 'new-low',
        likes: '90',
        plays: '900'
      }));
      tracks.insertAdjacentHTML('beforeend', trackMarkup({
        id: 'new-high',
        likes: '200',
        plays: '2,000'
      }));
      await waitForScan(dom.window, 320);

      assert.deepEqual(trackOrder(tracks), ['new-low', 'new-high', 'b', 'a']);
      assert.equal(
        document.querySelector('[data-track-id="new-low"]').classList.contains(
          'sc-like-ratio-filtered'
        ),
        true
      );
      assert.equal(
        document.querySelector('[data-track-id="new-high"]').classList.contains(
          'sc-like-ratio-filtered'
        ),
        false
      );

      const newLow = document.querySelector('[data-track-id="new-low"]');
      newLow.querySelector('.sc-ministats-item').title = '1,200 plays';
      newLow.querySelector('.sc-ministats-plays').textContent = '1,200';
      await waitForScan(dom.window);

      assert.equal(newLow.classList.contains('sc-like-ratio-filtered'), false);
      assert.deepEqual(trackOrder(tracks), ['new-high', 'new-low', 'b', 'a']);
    } finally {
      dom.window.close();
    }
  });

  test('reapplies minimum likes when tracks load or like metrics change', async () => {
    const list = `
      <ul id="tracks">
        ${trackMarkup({ id: 'changing', likes: '5', plays: '2,000' })}
        ${trackMarkup({ id: 'unknown', likes: '-', plays: '2,000' })}
      </ul>
    `;
    const dom = startExtension(list);

    try {
      const document = dom.window.document;
      const tracks = document.querySelector('#tracks');
      const changing = document.querySelector('[data-track-id="changing"]');
      const unknown = document.querySelector('[data-track-id="unknown"]');
      setMinimumLikes(document, '10');

      assert.equal(changing.classList.contains('sc-like-ratio-filtered'), true);
      assert.equal(unknown.classList.contains('sc-like-ratio-filtered'), true);

      tracks.insertAdjacentHTML('beforeend', trackMarkup({
        id: 'new-low',
        likes: '9',
        plays: '2,000'
      }));
      changing.querySelector('.sc-button-label').textContent = '15';
      await waitForScan(dom.window, 320);

      assert.equal(changing.classList.contains('sc-like-ratio-filtered'), false);
      assert.equal(
        document.querySelector('[data-track-id="new-low"]').classList.contains(
          'sc-like-ratio-filtered'
        ),
        true
      );

      changing.querySelector('.sc-button-label').remove();
      await waitForScan(dom.window);

      assert.equal(changing.hasAttribute('data-sc-like-ratio-likes'), false);
      assert.equal(changing.classList.contains('sc-like-ratio-filtered'), true);

      unknown.querySelector('.sc-button-label').textContent = '20';
      await waitForScan(dom.window);

      assert.equal(unknown.classList.contains('sc-like-ratio-filtered'), false);
    } finally {
      dom.window.close();
    }
  });
});
