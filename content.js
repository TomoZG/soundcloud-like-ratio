(() => {
  'use strict';

  const TRACK_SELECTOR = 'li.soundList__item, .sound.streamContext';
  const LIST_ITEM_SELECTOR = 'li.soundList__item';
  const BADGE_CLASS = 'sc-like-ratio-extension';
  const SORT_CONTROL_CLASS = 'sc-like-ratio-sort-control';
  const LOW_SAMPLE_PLAY_COUNT = 1_000;
  const POPULAR_PLAY_COUNT = 1_000_000;
  const VERY_POPULAR_PLAY_COUNT = 10_000_000;

  const SELECTORS = {
    likeButton: 'button.sc-button-like',
    likeCount: 'button.sc-button-like .sc-button-label',
    plays: '.sc-ministats-plays'
  };

  const originalOrder = new WeakMap();
  let nextOriginalOrder = 0;
  let sortActive = false;
  let sortButton = null;

  function parseMetric(text) {
    if (!text) {
      return null;
    }

    const normalized = text
      .replace(/\u00a0/g, ' ')
      .trim()
      .toUpperCase();

    const match = normalized.match(
      /(\d{1,3}(?:[\s,]\d{3})+|\d+(?:[.,]\d+)?)\s*([KMB])?/
    );

    if (!match) {
      return null;
    }

    const suffix = match[2] ?? '';
    let numericPart = match[1].replace(/\s/g, '');

    if (suffix) {
      // Handles both 10.1K and locale-style 10,1K.
      numericPart = numericPart.replace(',', '.');
    } else {
      numericPart = numericPart.replace(/,/g, '');
    }

    const value = Number.parseFloat(numericPart);
    if (!Number.isFinite(value)) {
      return null;
    }

    const multiplier = {
      '': 1,
      K: 1_000,
      M: 1_000_000,
      B: 1_000_000_000
    }[suffix];

    return {
      value: Math.round(value * multiplier),
      approximate: suffix !== ''
    };
  }

  function getTrackRoot(candidate) {
    return candidate.closest(LIST_ITEM_SELECTOR)
      ?? candidate.closest('.sound.streamContext')
      ?? candidate;
  }

  function getListItem(track) {
    return track.matches(LIST_ITEM_SELECTOR)
      ? track
      : track.closest(LIST_ITEM_SELECTOR);
  }

  function rememberOriginalOrder(item) {
    if (!item || originalOrder.has(item)) {
      return;
    }

    originalOrder.set(item, nextOriginalOrder++);
  }

  function readLikes(track) {
    const countElement = track.querySelector(SELECTORS.likeCount);
    if (!countElement) {
      return null;
    }

    const parsed = parseMetric(countElement.textContent);
    if (!parsed) {
      return null;
    }

    return {
      ...parsed,
      element: countElement,
      button: countElement.closest(SELECTORS.likeButton)
    };
  }

  function readPlays(track) {
    const playsElement = track.querySelector(SELECTORS.plays);
    if (!playsElement) {
      return null;
    }

    // SoundCloud exposes the full play count on the parent <li title="... plays">.
    // Fall back to the visually hidden text, then the abbreviated visible count.
    const statItem = playsElement.closest('li.sc-ministats-item');
    const sources = [
      statItem?.getAttribute('title'),
      playsElement.querySelector('.sc-visuallyhidden')?.textContent,
      playsElement.textContent
    ];

    for (const source of sources) {
      const parsed = parseMetric(source);
      if (parsed) {
        return {
          ...parsed,
          element: playsElement
        };
      }
    }

    return null;
  }

  function formatPercentage(likes, plays) {
    const percentage = (likes.value / plays.value) * 100;
    const approximate = likes.approximate || plays.approximate;

    const percentageText = percentage >= 10
      ? percentage.toFixed(1)
      : percentage.toFixed(2);

    return {
      percentage,
      label: `${approximate ? '≈' : ''}${percentageText}%`
    };
  }

  function getPopularityLevel(plays) {
    if (plays >= VERY_POPULAR_PLAY_COUNT) return 'very-popular';
    if (plays >= POPULAR_PLAY_COUNT) return 'popular';
    return 'normal';
  }

  function getTier(percentage) {
    if (percentage >= 5) return 'high';
    if (percentage >= 3) return 'good';
    if (percentage >= 1.5) return 'average';
    return 'low';
  }

  function clearSortableValue(track) {
    const item = getListItem(track);
    if (item) {
      delete item.dataset.scLikeRatioValue;
    }
  }

  function addOrUpdateBadge(track) {
    const listItem = getListItem(track);
    rememberOriginalOrder(listItem);

    const likes = readLikes(track);
    const plays = readPlays(track);

    if (!likes || !plays || !likes.button) {
      clearSortableValue(track);
      return;
    }

    if (likes.value <= 0 || plays.value <= 0 || likes.value > plays.value) {
      clearSortableValue(track);
      return;
    }

    const toolbar = likes.button.closest('.sc-button-group') ?? likes.button.parentElement;
    if (!toolbar) {
      clearSortableValue(track);
      return;
    }

    let badge = toolbar.querySelector(`:scope > .${BADGE_CLASS}`);
    if (!badge) {
      badge = document.createElement('span');
      badge.className = BADGE_CLASS;
      badge.setAttribute('role', 'status');
      badge.setAttribute('aria-label', 'Like percentage');
      likes.button.insertAdjacentElement('afterend', badge);
    }

    const ratio = formatPercentage(likes, plays);
    const lowSample = plays.value < LOW_SAMPLE_PLAY_COUNT;
    const popularityLevel = getPopularityLevel(plays.value);

    badge.textContent = ratio.label;
    badge.dataset.tier = getTier(ratio.percentage);
    badge.dataset.lowSample = String(lowSample);
    badge.dataset.popularity = popularityLevel;
    badge.title = [
      `${likes.value.toLocaleString()} likes`,
      `${plays.value.toLocaleString()} plays`,
      `${ratio.percentage.toFixed(3)}% like rate`,
      lowSample ? 'Low sample size' : null,
      popularityLevel === 'popular'
        ? 'Popular track — like rate is less directly comparable'
        : null,
      popularityLevel === 'very-popular'
        ? 'Very popular track — like rate is less directly comparable'
        : null
    ].filter(Boolean).join(' · ');

    if (listItem) {
      listItem.dataset.scLikeRatioValue = String(ratio.percentage);
    }
  }

  function getSortableGroups() {
    const groups = new Map();

    document.querySelectorAll(LIST_ITEM_SELECTOR).forEach((item) => {
      rememberOriginalOrder(item);

      const parent = item.parentElement;
      if (!parent) {
        return;
      }

      if (!groups.has(parent)) {
        groups.set(parent, []);
      }

      groups.get(parent).push(item);
    });

    return groups;
  }

  function compareByPercentage(a, b) {
    const aValue = Number.parseFloat(a.dataset.scLikeRatioValue);
    const bValue = Number.parseFloat(b.dataset.scLikeRatioValue);
    const aValid = Number.isFinite(aValue);
    const bValid = Number.isFinite(bValue);

    if (aValid && bValid && aValue !== bValue) {
      return bValue - aValue;
    }

    if (aValid !== bValid) {
      return aValid ? -1 : 1;
    }

    return (originalOrder.get(a) ?? 0) - (originalOrder.get(b) ?? 0);
  }

  function compareByOriginalOrder(a, b) {
    return (originalOrder.get(a) ?? 0) - (originalOrder.get(b) ?? 0);
  }

  function reorderGroup(parent, items, comparator) {
    const sorted = [...items].sort(comparator);
    const alreadySorted = sorted.every((item, index) => item === items[index]);

    if (alreadySorted) {
      return;
    }

    const fragment = document.createDocumentFragment();
    sorted.forEach((item) => fragment.appendChild(item));
    parent.appendChild(fragment);
  }

  function applyCurrentSort() {
    const groups = getSortableGroups();
    const comparator = sortActive ? compareByPercentage : compareByOriginalOrder;

    groups.forEach((items, parent) => {
      reorderGroup(parent, items, comparator);
    });
  }

  function updateSortButton() {
    if (!sortButton) {
      return;
    }

    const sortableCount = document.querySelectorAll(
      `${LIST_ITEM_SELECTOR}[data-sc-like-ratio-value]`
    ).length;

    sortButton.hidden = sortableCount < 2;
    sortButton.textContent = sortActive ? 'Restore order' : 'Sort by % ↓';
    sortButton.setAttribute('aria-pressed', String(sortActive));
    sortButton.title = sortActive
      ? 'Restore SoundCloud’s original order'
      : 'Sort the currently loaded songs by like percentage, highest first';
  }

  function ensureSortControl() {
    if (sortButton?.isConnected) {
      updateSortButton();
      return;
    }

    sortButton = document.createElement('button');
    sortButton.type = 'button';
    sortButton.className = SORT_CONTROL_CLASS;
    sortButton.addEventListener('click', () => {
      sortActive = !sortActive;
      applyCurrentSort();
      updateSortButton();
    });

    document.body.appendChild(sortButton);
    updateSortButton();
  }

  function scan(root = document) {
    const candidates = [];

    if (root instanceof Element && root.matches(TRACK_SELECTOR)) {
      candidates.push(root);
    }

    candidates.push(...root.querySelectorAll(TRACK_SELECTOR));

    const processed = new Set();
    for (const candidate of candidates) {
      const track = getTrackRoot(candidate);
      if (processed.has(track)) {
        continue;
      }

      processed.add(track);
      addOrUpdateBadge(track);
    }

    ensureSortControl();

    // Keep newly loaded tracks in the selected order while sorting is active.
    if (sortActive) {
      applyCurrentSort();
    }
  }

  let scanTimer;
  function scheduleScan() {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(() => scan(document), 100);
  }

  scan(document);

  // Search results are inserted and updated dynamically by SoundCloud's SPA.
  new MutationObserver(scheduleScan).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });
})();
