(() => {
  'use strict';

  const TRACK_SELECTOR = 'li.soundList__item, .sound.streamContext';
  const LIST_ITEM_SELECTOR = 'li.soundList__item';
  const BADGE_CLASS = 'sc-like-ratio-extension';
  const CONTROLS_CLASS = 'sc-like-ratio-controls';
  const FILTERED_CLASS = 'sc-like-ratio-filtered';
  const EXTENSION_ELEMENT_SELECTOR = `.${BADGE_CLASS}, .${CONTROLS_CLASS}`;
  const PANEL_ID = 'sc-like-ratio-panel';
  const PANEL_TITLE_ID = 'sc-like-ratio-panel-title';
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
  let sortMode = 'original';
  let minimumPlays = null;
  let minimumLikes = null;
  let unknownCountMode = 'hide';
  let controls = null;
  let controlButton = null;
  let panel = null;
  let minimumPlaysInput = null;
  let playsThresholdError = null;
  let minimumLikesInput = null;
  let likesThresholdError = null;
  let unknownCountsSelect = null;
  let sortSelect = null;

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

  function clearRatioState(track) {
    track.querySelectorAll(`.${BADGE_CLASS}`).forEach((badge) => badge.remove());

    const item = getListItem(track);
    if (item) {
      delete item.dataset.scLikeRatioValue;
    }
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

    if (likes && likes.value >= 0) {
      setAttribute(track, 'data-sc-like-ratio-likes', String(likes.value));
    } else {
      delete track.dataset.scLikeRatioLikes;
    }

    if (!plays || plays.value < 0) {
      clearRatioState(track);
      delete track.dataset.scLikeRatioPlays;
      return;
    }

    setAttribute(track, 'data-sc-like-ratio-plays', String(plays.value));

    if (
      plays.value === 0
      || !likes
      || !likes.button
      || likes.value <= 0
      || likes.value > plays.value
    ) {
      clearRatioState(track);
      return;
    }

    const toolbar = likes.button.closest('.sc-button-group') ?? likes.button.parentElement;
    if (!toolbar) {
      clearRatioState(track);
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

  function getTrackRoots() {
    const tracks = new Set();

    document.querySelectorAll(TRACK_SELECTOR).forEach((candidate) => {
      tracks.add(getTrackRoot(candidate));
    });

    return [...tracks];
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
    const comparator = sortMode === 'ratio'
      ? compareByPercentage
      : compareByOriginalOrder;

    groups.forEach((items, parent) => {
      reorderGroup(parent, items, comparator);
    });
  }

  function applyCurrentFilter() {
    getTrackRoots().forEach((track) => {
      const plays = Number.parseFloat(track.dataset.scLikeRatioPlays);
      const likes = Number.parseFloat(track.dataset.scLikeRatioLikes);
      const belowMinimumPlays = minimumPlays !== null
        && Number.isFinite(plays)
        && plays < minimumPlays;
      const belowMinimumLikes = minimumLikes !== null
        && Number.isFinite(likes)
        && likes < minimumLikes;
      const missingFilteredPlays = minimumPlays !== null
        && !Number.isFinite(plays);
      const missingFilteredLikes = minimumLikes !== null
        && !Number.isFinite(likes);
      const missingRequiredCount = unknownCountMode === 'hide'
        && (missingFilteredPlays || missingFilteredLikes);

      track.classList.toggle(
        FILTERED_CLASS,
        belowMinimumPlays || belowMinimumLikes || missingRequiredCount
      );
    });
  }

  function setThresholdError(input, error, message = '') {
    if (!input || !error) {
      return;
    }

    setAttribute(input, 'aria-invalid', String(Boolean(message)));
    setTextContent(error, message);
    error.hidden = !message;
  }

  function parseMinimumInput(input, error) {
    const rawValue = input.value.trim();
    let nextMinimum = null;

    if (rawValue) {
      if (!/^\d+$/.test(rawValue)) {
        setThresholdError(
          input,
          error,
          'Enter a whole number of 0 or more.'
        );
        return undefined;
      }

      nextMinimum = Number(rawValue);
      if (!Number.isSafeInteger(nextMinimum)) {
        setThresholdError(input, error, 'Enter a smaller whole number.');
        return undefined;
      }
    }

    input.value = nextMinimum === null ? '' : String(nextMinimum);
    setThresholdError(input, error);
    return nextMinimum;
  }

  function commitMinimumPlays() {
    const nextMinimum = parseMinimumInput(
      minimumPlaysInput,
      playsThresholdError
    );
    if (nextMinimum === undefined) {
      return false;
    }

    minimumPlays = nextMinimum;
    applyCurrentFilter();
    updateControls();
    return true;
  }

  function commitMinimumLikes() {
    const nextMinimum = parseMinimumInput(
      minimumLikesInput,
      likesThresholdError
    );
    if (nextMinimum === undefined) {
      return false;
    }

    minimumLikes = nextMinimum;
    applyCurrentFilter();
    updateControls();
    return true;
  }

  function setPanelOpen(open, returnFocus = false) {
    if (!panel || !controlButton) {
      return;
    }

    panel.hidden = !open;
    setAttribute(controlButton, 'aria-expanded', String(open));

    if (open) {
      minimumPlaysInput.focus();
    } else if (returnFocus) {
      controlButton.focus();
    }
  }

  function resetSettings() {
    minimumPlays = null;
    minimumLikes = null;
    unknownCountMode = 'hide';
    sortMode = 'original';
    minimumPlaysInput.value = '';
    minimumLikesInput.value = '';
    unknownCountsSelect.value = unknownCountMode;
    sortSelect.value = sortMode;
    setThresholdError(minimumPlaysInput, playsThresholdError);
    setThresholdError(minimumLikesInput, likesThresholdError);
    applyCurrentFilter();
    applyCurrentSort();
    updateControls();
  }

  function updateControls() {
    if (!controls || !controlButton) {
      return;
    }

    const hidden = getTrackRoots().length === 0;
    controls.hidden = hidden;
    if (hidden && panel && !panel.hidden) {
      setPanelOpen(false);
    }

    const activeSettings = [];
    if (minimumPlays !== null) {
      activeSettings.push(`at least ${minimumPlays.toLocaleString()} plays`);
    }
    if (minimumLikes !== null) {
      activeSettings.push(`at least ${minimumLikes.toLocaleString()} likes`);
    }
    if (unknownCountMode === 'show') {
      activeSettings.push('show tracks with unknown filtered counts');
    }
    if (sortMode === 'ratio') {
      activeSettings.push('like ratio, highest first');
    }

    const active = activeSettings.length > 0;
    controlButton.dataset.active = String(active);
    setTextContent(controlButton, 'Filter & sort');
    setAttribute(controlButton, 'aria-label', active
      ? `Filter and sort, active: ${activeSettings.join('; ')}`
      : 'Filter and sort');
    setAttribute(controlButton, 'title', active
      ? `Active: ${activeSettings.join(' · ')}`
      : 'Filter and sort loaded songs');
  }

  function ensureControls() {
    if (controls?.isConnected) {
      updateControls();
      return;
    }

    controls = document.createElement('div');
    controls.className = CONTROLS_CLASS;

    controlButton = document.createElement('button');
    controlButton.type = 'button';
    controlButton.className = 'sc-like-ratio-control-button';
    controlButton.setAttribute('aria-controls', PANEL_ID);
    controlButton.setAttribute('aria-expanded', 'false');
    controlButton.addEventListener('click', () => {
      setPanelOpen(panel.hidden);
    });

    panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.className = 'sc-like-ratio-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', PANEL_TITLE_ID);

    const title = document.createElement('h2');
    title.id = PANEL_TITLE_ID;
    title.textContent = 'Filter & sort';

    const thresholdField = document.createElement('div');
    thresholdField.className = 'sc-like-ratio-field';

    const thresholdLabel = document.createElement('label');
    thresholdLabel.setAttribute('for', 'sc-like-ratio-minimum-plays');
    thresholdLabel.textContent = 'Minimum plays';

    minimumPlaysInput = document.createElement('input');
    minimumPlaysInput.id = 'sc-like-ratio-minimum-plays';
    minimumPlaysInput.type = 'number';
    minimumPlaysInput.min = '0';
    minimumPlaysInput.step = '1';
    minimumPlaysInput.placeholder = 'No minimum';
    minimumPlaysInput.inputMode = 'numeric';
    minimumPlaysInput.value = minimumPlays === null ? '' : String(minimumPlays);
    minimumPlaysInput.setAttribute(
      'aria-describedby',
      'sc-like-ratio-plays-threshold-error'
    );
    minimumPlaysInput.addEventListener('input', () => setThresholdError(
      minimumPlaysInput,
      playsThresholdError
    ));
    minimumPlaysInput.addEventListener('blur', commitMinimumPlays);
    minimumPlaysInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commitMinimumPlays();
      }
    });

    playsThresholdError = document.createElement('p');
    playsThresholdError.id = 'sc-like-ratio-plays-threshold-error';
    playsThresholdError.className = 'sc-like-ratio-error';
    playsThresholdError.setAttribute('aria-live', 'polite');
    playsThresholdError.hidden = true;

    thresholdField.append(
      thresholdLabel,
      minimumPlaysInput,
      playsThresholdError
    );

    const likesThresholdField = document.createElement('div');
    likesThresholdField.className = 'sc-like-ratio-field';

    const likesThresholdLabel = document.createElement('label');
    likesThresholdLabel.setAttribute('for', 'sc-like-ratio-minimum-likes');
    likesThresholdLabel.textContent = 'Minimum likes';

    minimumLikesInput = document.createElement('input');
    minimumLikesInput.id = 'sc-like-ratio-minimum-likes';
    minimumLikesInput.type = 'number';
    minimumLikesInput.min = '0';
    minimumLikesInput.step = '1';
    minimumLikesInput.placeholder = 'No minimum';
    minimumLikesInput.inputMode = 'numeric';
    minimumLikesInput.value = minimumLikes === null ? '' : String(minimumLikes);
    minimumLikesInput.setAttribute(
      'aria-describedby',
      'sc-like-ratio-likes-threshold-error'
    );
    minimumLikesInput.addEventListener('input', () => setThresholdError(
      minimumLikesInput,
      likesThresholdError
    ));
    minimumLikesInput.addEventListener('blur', commitMinimumLikes);
    minimumLikesInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commitMinimumLikes();
      }
    });

    likesThresholdError = document.createElement('p');
    likesThresholdError.id = 'sc-like-ratio-likes-threshold-error';
    likesThresholdError.className = 'sc-like-ratio-error';
    likesThresholdError.setAttribute('aria-live', 'polite');
    likesThresholdError.hidden = true;

    likesThresholdField.append(
      likesThresholdLabel,
      minimumLikesInput,
      likesThresholdError
    );

    const unknownCountsField = document.createElement('div');
    unknownCountsField.className = 'sc-like-ratio-field';

    const unknownCountsLabel = document.createElement('label');
    unknownCountsLabel.setAttribute('for', 'sc-like-ratio-unknown-counts');
    unknownCountsLabel.textContent = 'Unknown filtered counts';

    unknownCountsSelect = document.createElement('select');
    unknownCountsSelect.id = 'sc-like-ratio-unknown-counts';

    const hideUnknownOption = document.createElement('option');
    hideUnknownOption.value = 'hide';
    hideUnknownOption.textContent = 'Hide tracks';

    const showUnknownOption = document.createElement('option');
    showUnknownOption.value = 'show';
    showUnknownOption.textContent = 'Show tracks';

    unknownCountsSelect.append(hideUnknownOption, showUnknownOption);
    unknownCountsSelect.value = unknownCountMode;
    unknownCountsSelect.addEventListener('change', () => {
      unknownCountMode = unknownCountsSelect.value;
      applyCurrentFilter();
      updateControls();
    });

    unknownCountsField.append(unknownCountsLabel, unknownCountsSelect);

    const sortField = document.createElement('div');
    sortField.className = 'sc-like-ratio-field';

    const sortLabel = document.createElement('label');
    sortLabel.setAttribute('for', 'sc-like-ratio-sort-order');
    sortLabel.textContent = 'Order';

    sortSelect = document.createElement('select');
    sortSelect.id = 'sc-like-ratio-sort-order';

    const originalOption = document.createElement('option');
    originalOption.value = 'original';
    originalOption.textContent = 'Original order';

    const ratioOption = document.createElement('option');
    ratioOption.value = 'ratio';
    ratioOption.textContent = 'Like ratio — highest first';

    sortSelect.append(originalOption, ratioOption);
    sortSelect.value = sortMode;
    sortSelect.addEventListener('change', () => {
      sortMode = sortSelect.value;
      applyCurrentSort();
      updateControls();
    });

    sortField.append(sortLabel, sortSelect);

    const actions = document.createElement('div');
    actions.className = 'sc-like-ratio-actions';

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'sc-like-ratio-reset';
    resetButton.textContent = 'Reset';
    resetButton.addEventListener('click', resetSettings);

    const doneButton = document.createElement('button');
    doneButton.type = 'button';
    doneButton.className = 'sc-like-ratio-done';
    doneButton.textContent = 'Done';
    doneButton.addEventListener('click', () => setPanelOpen(false, true));

    actions.append(resetButton, doneButton);
    panel.append(
      title,
      thresholdField,
      likesThresholdField,
      unknownCountsField,
      sortField,
      actions
    );
    controls.append(panel, controlButton);
    document.body.appendChild(controls);
    updateControls();
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

    ensureControls();
    applyCurrentFilter();

    // Keep newly loaded tracks in the selected order while sorting is active.
    if (sortMode === 'ratio') {
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

  function handleDocumentClick(event) {
    if (
      panel
      && !panel.hidden
      && controls
      && !controls.contains(event.target)
    ) {
      setPanelOpen(false);
    }
  }

  function handleDocumentKeydown(event) {
    if (event.key === 'Escape' && panel && !panel.hidden) {
      event.preventDefault();
      setPanelOpen(false, true);
    }
  }

  scan(document);
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleDocumentKeydown);

  // Search results are inserted and updated dynamically by SoundCloud's SPA.
  new MutationObserver(handleMutations).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });
})();
