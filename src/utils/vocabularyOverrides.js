const STORAGE_KEY = 'bubwords:vocabulary-overrides:v1';
export const KEY_WORDS_CATEGORY_ID = '__key_words__';

const EMPTY_OVERRIDES = {
  hiddenCategories: [],
  hiddenItems: [],
  categoryItemOverrides: {},
  customCategories: {},
  orderOverrides: {
    keyWords: [],
    categories: [],
    categoryItems: {},
  },
};

function uniqueList(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function normalizeOverrides(raw) {
  return {
    hiddenCategories: uniqueList(raw?.hiddenCategories),
    hiddenItems: uniqueList(raw?.hiddenItems),
    categoryItemOverrides: { ...(raw?.categoryItemOverrides || {}) },
    customCategories: { ...(raw?.customCategories || {}) },
    orderOverrides: {
      keyWords: uniqueList(raw?.orderOverrides?.keyWords),
      categories: uniqueList(raw?.orderOverrides?.categories),
      categoryItems: { ...(raw?.orderOverrides?.categoryItems || {}) },
    },
  };
}

function orderIds(baseIds, overrideIds) {
  const source = uniqueList(baseIds);
  const override = uniqueList(overrideIds);
  const allowed = new Set(source);
  const ordered = [];

  override.forEach((id) => {
    if (allowed.has(id) && !ordered.includes(id)) {
      ordered.push(id);
    }
  });

  source.forEach((id) => {
    if (!ordered.includes(id)) {
      ordered.push(id);
    }
  });

  return ordered;
}

export function loadOverrides() {
  if (typeof window === 'undefined') {
    return normalizeOverrides(EMPTY_OVERRIDES);
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return normalizeOverrides(EMPTY_OVERRIDES);
    }

    return normalizeOverrides(JSON.parse(raw));
  } catch {
    return normalizeOverrides(EMPTY_OVERRIDES);
  }
}

export function saveOverrides(overrides) {
  const normalized = normalizeOverrides(overrides);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }

  return normalized;
}

export function applyOverrides(baseConfig, overridesInput) {
  if (!baseConfig) return null;

  const overrides = normalizeOverrides(overridesInput || EMPTY_OVERRIDES);

  const hiddenCategorySet = new Set(overrides.hiddenCategories);
  const hiddenItemSet = new Set(overrides.hiddenItems);

  const baseItems = baseConfig.items || {};
  const validItemSet = new Set(Object.keys(baseItems));

  const toVisibleItemIds = (ids) =>
    uniqueList(ids).filter((id) => validItemSet.has(id) && !hiddenItemSet.has(id));

  const baseCategories = (baseConfig.categories || []).map((cat) => ({
    ...cat,
    items: toVisibleItemIds(cat.items),
  }));

  const visibleCategories = baseCategories
    .map((cat) => {
      const overrideItems = overrides.categoryItemOverrides[cat.id];
      const items = overrideItems ? toVisibleItemIds(overrideItems) : cat.items;
      return { ...cat, items };
    })
    .filter((cat) => !hiddenCategorySet.has(cat.id));

  Object.entries(overrides.customCategories).forEach(([categoryId, category]) => {
    if (hiddenCategorySet.has(categoryId)) return;

    visibleCategories.push({
      id: categoryId,
      name: category?.name || 'New Category',
      color: category?.color || '#ECEFF1',
      accentColor: category?.accentColor || '#546E7A',
      items: toVisibleItemIds(category?.items || []),
    });
  });

  const categoryById = new Map(visibleCategories.map((cat) => [cat.id, cat]));
  const orderedCategoryIds = orderIds(
    visibleCategories.map((cat) => cat.id),
    overrides.orderOverrides.categories
  );

  const categories = orderedCategoryIds
    .map((catId) => categoryById.get(catId))
    .filter(Boolean)
    .map((cat) => {
      const itemOrderOverride = overrides.orderOverrides.categoryItems?.[cat.id] || [];
      return {
        ...cat,
        items: orderIds(cat.items, itemOrderOverride),
      };
    });

  const keyWordMembershipOverride = overrides.categoryItemOverrides[KEY_WORDS_CATEGORY_ID];
  const baseKeyWords = toVisibleItemIds(keyWordMembershipOverride || (baseConfig.keyWords || []));
  const keyWordOverrides = toVisibleItemIds(overrides.orderOverrides.keyWords || []);

  const keyWords = [];
  keyWordOverrides.forEach((id) => {
    if (!keyWords.includes(id)) keyWords.push(id);
  });
  baseKeyWords.forEach((id) => {
    if (!keyWords.includes(id)) keyWords.push(id);
  });

  const visibleItems = {};
  Object.entries(baseItems).forEach(([itemId, item]) => {
    if (!hiddenItemSet.has(itemId)) {
      visibleItems[itemId] = item;
    }
  });

  return {
    ...baseConfig,
    keyWords,
    categories,
    items: visibleItems,
  };
}

export function createEmptyOverrides() {
  return normalizeOverrides(EMPTY_OVERRIDES);
}
