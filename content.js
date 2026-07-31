(() => {
  'use strict';

  const TRACK_SELECTOR = 'li.soundList__item, .sound.streamContext';
  const LIST_ITEM_SELECTOR = 'li.soundList__item';
  const BADGE_CLASS = 'sc-like-ratio-extension';
  const SORT_CONTROL_CLASS = 'sc-like-ratio-sort-control';
  const EXTENSION_ELEMENT_SELECTOR = `.${BADGE_CLASS}, .${SORT_CONTROL_CLASS}`;
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

    const match = normalized.match(/(\d+(?:[\s.,]\d+)*)\s*([KMB])?/);

    if (!match) {
      return null;
    }

    const suffix = match[2] ?? '';
    let numericPart = match[1].replace(/\s/g, '');

    if (suffix) {
      // The final punctuation mark is the decimal separator. Any earlier marks
      // are grouping separators, which supports both 1,234.5K and 1.234,5K.
      const separatorIndex = Math.max(
        numericPart.lastIndexOf('.'),
        numericPart.lastIndexOf(',')
      );

      if (separatorIndex >= 0) {
        const integerPart = numericPart
          .slice(0, separatorIndex)
          .replace(/[.,]/g, '');
        const decimalPart = numericPart
          .slice(separatorIndex + 1)
          .replace(/[.,]/g, '');
        numericPart = `${integerPart}.${decimalPart}`;
      }
    } else {
      // Exact play and like counts are integers, regardless of locale grouping.
      numericPart = numericPart.replace(/[.,]/g, '');
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

  // Allow the calculation helpers to be tested with Node without starting the
  // browser-only DOM observer. This branch is unreachable in a content script.
  if (
    typeof module !== 'undefined'
    && module.exports
    && typeof document === 'undefined'
  ) {
    module.exports = {
      formatPercentage,
      getPopularityLevel,
      getTier,
      parseMetric
    };
    return;
  }

  function clearSortableValue(track) {
    const item = getListItem(track);
    if (item) {
      delete item.dataset.scLikeRatioValue;
    }
  }

  function clearTrackState(track) {
    track.querySelectorAll(`.${BADGE_CLASS}`).forEach((badge) => badge.remove());
    clearSortableValue(track);
  }

  function setTextContent(element, value) {
    if (element.textContent !== value) {
      element.textContent = value;
    }
  }

  function setAttribute(element, name, value) {
    if (element.getAttribute(name) !== value) {
      element.setAttribute(name, value);
    }
  }

  function addOrUpdateBadge(track) {
    const listItem = getListItem(track);
    rememberOriginalOrder(listItem);

    const likes = readLikes(track);
    const plays = readPlays(track);

    if (!likes || !plays || !likes.button) {
      clearTrackState(track);
      return;
    }

    if (likes.value <= 0 || plays.value <= 0 || likes.value > plays.value) {
      clearTrackState(track);
      return;
    }

    const toolbar = likes.button.closest('.sc-button-group') ?? likes.button.parentElement;
    if (!toolbar) {
      clearTrackState(track);
      return;
    }

    let badge = toolbar.querySelector(`:scope > .${BADGE_CLASS}`);
    track.querySelectorAll(`.${BADGE_CLASS}`).forEach((existingBadge) => {
      if (existingBadge !== badge) {
        existingBadge.remove();
      }
    });

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

    setTextContent(badge, ratio.label);
    setAttribute(badge, 'data-tier', getTier(ratio.percentage));
    setAttribute(badge, 'data-low-sample', String(lowSample));
    setAttribute(badge, 'data-popularity', popularityLevel);
    setAttribute(badge, 'title', [
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
    ].filter(Boolean).join(' · '));

    if (listItem) {
      setAttribute(
        listItem,
        'data-sc-like-ratio-value',
        String(ratio.percentage)
      );
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

    const hidden = sortableCount < 2;
    if (sortButton.hidden !== hidden) {
      sortButton.hidden = hidden;
    }

    setTextContent(sortButton, sortActive ? 'Restore order' : 'Sort by % ↓');
    setAttribute(sortButton, 'aria-pressed', String(sortActive));
    setAttribute(sortButton, 'title', sortActive
      ? 'Restore SoundCloud’s original order'
      : 'Sort the currently loaded songs by like percentage, highest first');
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

  function isExtensionNode(node) {
    const element = node instanceof Element ? node : node.parentElement;
    return element instanceof Element
      && (
        element.matches(EXTENSION_ELEMENT_SELECTOR)
        || element.closest(EXTENSION_ELEMENT_SELECTOR)
      );
  }

  function isExtensionOnlyMutation(mutation) {
    if (isExtensionNode(mutation.target)) {
      return true;
    }

    if (mutation.type !== 'childList') {
      return false;
    }

    const changedNodes = [
      ...mutation.addedNodes,
      ...mutation.removedNodes
    ];

    return changedNodes.length > 0 && changedNodes.every(isExtensionNode);
  }

  function handleMutations(mutations) {
    if (mutations.some((mutation) => !isExtensionOnlyMutation(mutation))) {
      scheduleScan();
    }
  }

  scan(document);

  // Search results are inserted and updated dynamically by SoundCloud's SPA.
  new MutationObserver(handleMutations).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });
})();
