import React, { useEffect, useMemo, useState } from 'react';
import {
  applyOverrides,
  KEY_WORDS_CATEGORY_ID,
  createEmptyOverrides,
  saveOverrides,
} from '../utils/vocabularyOverrides.js';
import '../styles/ParentMode.css';

function toSlug(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function moveInList(list, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function uniqueIds(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function orderIds(baseIds, overrideIds) {
  const base = uniqueIds(baseIds);
  const override = uniqueIds(overrideIds);
  const allowed = new Set(base);
  const ordered = [];

  override.forEach((id) => {
    if (allowed.has(id) && !ordered.includes(id)) {
      ordered.push(id);
    }
  });

  base.forEach((id) => {
    if (!ordered.includes(id)) {
      ordered.push(id);
    }
  });

  return ordered;
}

function buildMathProblem() {
  const first = Math.floor(Math.random() * 40) + 11;
  let second = Math.floor(Math.random() * 40) + 11;

  while (second === first) {
    second = Math.floor(Math.random() * 40) + 11;
  }

  const useAddition = Math.random() < 0.5;

  if (useAddition) {
    return {
      text: `${first} + ${second}`,
      answer: first + second,
    };
  }

  const max = Math.max(first, second);
  const min = Math.min(first, second);
  return {
    text: `${max} - ${min}`,
    answer: max - min,
  };
}

export function ParentMode({ baseConfig, initialOverrides, onClose, onApply }) {
  const [draft, setDraft] = useState(initialOverrides || createEmptyOverrides());
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  const [unlocked, setUnlocked] = useState(false);
  const [mathProblem, setMathProblem] = useState(buildMathProblem());
  const [mathAnswer, setMathAnswer] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [lastSubmitAt, setLastSubmitAt] = useState(0);

  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [pendingCategoryName, setPendingCategoryName] = useState('');
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [isAddItemsOpen, setIsAddItemsOpen] = useState(false);
  const [pendingCategoryItems, setPendingCategoryItems] = useState([]);
  const [draggedItemId, setDraggedItemId] = useState('');
  const [dragOverItemId, setDragOverItemId] = useState('');
  const [openItemMenuId, setOpenItemMenuId] = useState('');

  const effectiveConfig = useMemo(
    () => applyOverrides(baseConfig, draft),
    [baseConfig, draft]
  );

  useEffect(() => {
    setDraft(initialOverrides || createEmptyOverrides());
  }, [initialOverrides]);

  useEffect(() => {
    if (!lockedUntil) {
      setSecondsLeft(0);
      return undefined;
    }

    const timer = window.setInterval(() => {
      const remainingMs = Math.max(0, lockedUntil - Date.now());
      const remainingSec = Math.ceil(remainingMs / 1000);
      setSecondsLeft(remainingSec);

      if (remainingMs <= 0) {
        setLockedUntil(0);
        setFailedAttempts(0);
        setMathProblem(buildMathProblem());
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [lockedUntil]);

  useEffect(() => {
    if (!openItemMenuId) return undefined;

    const onPointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const clickedInsideMenu = target.closest('.parent-mode__tile-menu');
      const clickedTrigger = target.closest('.parent-mode__tile-menu-trigger');
      if (!clickedInsideMenu && !clickedTrigger) {
        setOpenItemMenuId('');
      }
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpenItemMenuId('');
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [openItemMenuId]);

  const allItems = useMemo(() => {
    return Object.entries(baseConfig?.items || {}).map(([id, item]) => ({
      id,
      label: item.label || id,
    }));
  }, [baseConfig]);

  const allManagedCategories = useMemo(() => {
    const validItemSet = new Set(Object.keys(baseConfig?.items || {}));
    const normalizeCategoryItems = (ids) =>
      uniqueIds(ids).filter((id) => validItemSet.has(id));

    const fromBase = (baseConfig?.categories || []).map((category) => {
      const overrideItems = draft.categoryItemOverrides?.[category.id];
      return {
        ...category,
        items: normalizeCategoryItems(overrideItems || category.items),
      };
    });

    const fromCustom = Object.entries(draft.customCategories || {}).map(
      ([categoryId, category]) => ({
        id: categoryId,
        name: category?.name || 'New Category',
        color: category?.color || '#ECEFF1',
        accentColor: category?.accentColor || '#546E7A',
        items: normalizeCategoryItems(category?.items || []),
      })
    );

    const byId = new Map([...fromBase, ...fromCustom].map((category) => [category.id, category]));
    const orderedIds = orderIds(
      Array.from(byId.keys()),
      draft.orderOverrides?.categories || []
    );

    return orderedIds.map((categoryId) => byId.get(categoryId)).filter(Boolean);
  }, [baseConfig, draft]);

  const editorManagedCategories = useMemo(() => {
    return [
      {
        id: KEY_WORDS_CATEGORY_ID,
        name: '⭐ Key Words',
        items: effectiveConfig?.keyWords || [],
      },
      ...allManagedCategories,
    ];
  }, [effectiveConfig, allManagedCategories]);

  useEffect(() => {
    const categoryIds = editorManagedCategories.map((cat) => cat.id);

    if (!categoryIds.length) {
      setSelectedCategoryId('');
      return;
    }

    if (!selectedCategoryId || !categoryIds.includes(selectedCategoryId)) {
      setSelectedCategoryId(categoryIds[0]);
    }
  }, [editorManagedCategories, selectedCategoryId]);

  const hiddenItemSet = useMemo(() => new Set(draft.hiddenItems || []), [draft.hiddenItems]);

  const currentCategory = useMemo(() => {
    return editorManagedCategories.find((cat) => cat.id === selectedCategoryId) || null;
  }, [editorManagedCategories, selectedCategoryId]);

  const editingCategory = useMemo(() => {
    if (!isEditCategoryOpen) return null;
    return editorManagedCategories.find((cat) => cat.id === selectedCategoryId) || null;
  }, [isEditCategoryOpen, editorManagedCategories, selectedCategoryId]);

  const updateDraft = (updater) => {
    setDraft((prev) => updater(prev));
  };

  const toggleCategoryVisibility = (categoryId) => {
    updateDraft((prev) => {
      const hidden = new Set(prev.hiddenCategories || []);

      if (hidden.has(categoryId)) {
        hidden.delete(categoryId);
      } else {
        hidden.add(categoryId);
      }

      return {
        ...prev,
        hiddenCategories: Array.from(hidden),
      };
    });
  };

  const moveCategory = (categoryId, direction) => {
    const currentOrder = allManagedCategories.map((cat) => cat.id);
    const index = currentOrder.indexOf(categoryId);
    if (index < 0) return;

    const movedVisible = moveInList(currentOrder, index, direction);

    updateDraft((prev) => {
      const previousOrder = prev.orderOverrides?.categories || [];
      const extras = previousOrder.filter((id) => !movedVisible.includes(id));

      return {
        ...prev,
        orderOverrides: {
          ...prev.orderOverrides,
          categories: [...movedVisible, ...extras],
        },
      };
    });
  };

  const createCategory = () => {
    const trimmed = pendingCategoryName.trim();
    if (!trimmed) return;

    const idBase = toSlug(trimmed) || 'new-category';
    const categoryId = `${idBase}-${Date.now().toString(36)}`;

    updateDraft((prev) => {
      const customCategories = {
        ...prev.customCategories,
        [categoryId]: {
          name: trimmed,
          items: [],
          color: '#ECEFF1',
          accentColor: '#546E7A',
        },
      };

      const currentOrder = prev.orderOverrides?.categories || [];

      return {
        ...prev,
        customCategories,
        orderOverrides: {
          ...prev.orderOverrides,
          categories: [...currentOrder, categoryId],
        },
      };
    });

    setSelectedCategoryId(categoryId);
    setPendingCategoryName('');
    setIsCreateCategoryOpen(false);
  };

  const openCreateCategoryModal = () => {
    setPendingCategoryName('');
    setIsCreateCategoryOpen(true);
  };

  const cancelCreateCategoryModal = () => {
    setPendingCategoryName('');
    setIsCreateCategoryOpen(false);
  };

  const openEditCategoryModal = (categoryId) => {
    setSelectedCategoryId(categoryId);
    setOpenItemMenuId('');
    setDraggedItemId('');
    setDragOverItemId('');
    setIsAddItemsOpen(false);
    setPendingCategoryItems([]);
    setItemSearch('');
    setIsEditCategoryOpen(true);
  };

  const closeEditCategoryModal = () => {
    setIsEditCategoryOpen(false);
    setOpenItemMenuId('');
    setDraggedItemId('');
    setDragOverItemId('');
    setIsAddItemsOpen(false);
    setPendingCategoryItems([]);
    setItemSearch('');
  };

  const setCategoryItems = (categoryId, nextItems) => {
    updateDraft((prev) => {
      if (categoryId === KEY_WORDS_CATEGORY_ID) {
        return {
          ...prev,
          categoryItemOverrides: {
            ...prev.categoryItemOverrides,
            [KEY_WORDS_CATEGORY_ID]: nextItems,
          },
          orderOverrides: {
            ...prev.orderOverrides,
            keyWords: nextItems,
          },
        };
      }

      if (prev.customCategories?.[categoryId]) {
        return {
          ...prev,
          customCategories: {
            ...prev.customCategories,
            [categoryId]: {
              ...prev.customCategories[categoryId],
              items: nextItems,
            },
          },
        };
      }

      return {
        ...prev,
        categoryItemOverrides: {
          ...prev.categoryItemOverrides,
          [categoryId]: nextItems,
        },
      };
    });
  };

  const removeItemFromCategory = (categoryId, itemId) => {
    const category = editorManagedCategories.find((cat) => cat.id === categoryId);
    if (!category) return;

    const nextItems = category.items.filter((id) => id !== itemId);
    setCategoryItems(categoryId, nextItems);
  };

  const moveCategoryItem = (categoryId, itemId, direction) => {
    const category = editorManagedCategories.find((cat) => cat.id === categoryId);
    if (!category) return;

    const index = category.items.indexOf(itemId);
    if (index < 0) return;

    const nextItems = moveInList(category.items, index, direction);
    setCategoryItems(categoryId, nextItems);
  };

  const reorderCategoryItemsByDrop = (categoryId, sourceItemId, targetItemId) => {
    const category = editorManagedCategories.find((cat) => cat.id === categoryId);
    if (!category) return;

    const sourceIndex = category.items.indexOf(sourceItemId);
    const targetIndex = category.items.indexOf(targetItemId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;

    const nextItems = [...category.items];
    const [moved] = nextItems.splice(sourceIndex, 1);
    nextItems.splice(targetIndex, 0, moved);
    setCategoryItems(categoryId, nextItems);
  };

  const addItemsToCategory = (categoryId, itemIds) => {
    const category = editorManagedCategories.find((cat) => cat.id === categoryId);
    if (!category) return;

    const selected = Array.from(new Set((itemIds || []).filter(Boolean)));
    if (!selected.length) return;

    const nextItems = [...category.items];
    selected.forEach((itemId) => {
      if (!nextItems.includes(itemId)) {
        nextItems.push(itemId);
      }
    });

    setCategoryItems(categoryId, nextItems);
  };

  const togglePendingCategoryItem = (itemId) => {
    setPendingCategoryItems((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId);
      }
      return [...prev, itemId];
    });
  };

  const openAddItemsPicker = () => {
    setIsAddItemsOpen(true);
    setPendingCategoryItems([]);
    setItemSearch('');
  };

  const cancelAddItemsPicker = () => {
    setIsAddItemsOpen(false);
    setPendingCategoryItems([]);
    setItemSearch('');
  };

  const confirmAddItems = () => {
    if (!editingCategory) return;
    addItemsToCategory(editingCategory.id, pendingCategoryItems);
    cancelAddItemsPicker();
  };

  const toggleItemHidden = (itemId) => {
    updateDraft((prev) => {
      const hidden = new Set(prev.hiddenItems || []);

      if (hidden.has(itemId)) {
        hidden.delete(itemId);
      } else {
        hidden.add(itemId);
      }

      return {
        ...prev,
        hiddenItems: Array.from(hidden),
      };
    });
  };

  const submitMathAnswer = (event) => {
    event.preventDefault();

    const now = Date.now();
    if (now < lockedUntil) return;

    if (now - lastSubmitAt < 600) {
      return;
    }

    setLastSubmitAt(now);

    const numericAnswer = Number(mathAnswer.trim());

    if (Number.isNaN(numericAnswer)) {
      return;
    }

    if (numericAnswer === mathProblem.answer) {
      setUnlocked(true);
      setMathProblem(buildMathProblem());
      setMathAnswer('');
      setFailedAttempts(0);
      return;
    }

    const nextFails = failedAttempts + 1;
    setFailedAttempts(nextFails);

    if (nextFails >= 3) {
      setLockedUntil(Date.now() + 10_000);
      setMathProblem(buildMathProblem());
      setMathAnswer('');
      setFailedAttempts(0);
    }
  };

  const handleSave = () => {
    const stored = saveOverrides(draft);
    onApply?.(stored);
    onClose?.();
  };

  const handleCancel = () => {
    onClose?.();
  };

  const handleClearSettings = () => {
    const shouldClear = window.confirm(
      'Clear all Parent Mode settings and restore defaults? This will remove hidden items, custom categories, and ordering changes.'
    );

    if (!shouldClear) return;

    const cleared = saveOverrides(createEmptyOverrides());

    setDraft(cleared);
    setSelectedCategoryId('');
    setIsCreateCategoryOpen(false);
    setPendingCategoryName('');
    setIsEditCategoryOpen(false);
    setItemSearch('');
    setIsAddItemsOpen(false);
    setPendingCategoryItems([]);
    setDraggedItemId('');
    setDragOverItemId('');
    setOpenItemMenuId('');

    onApply?.(cleared);
  };

  if (!baseConfig || !effectiveConfig) return null;

  if (!unlocked) {
    const isLocked = lockedUntil > Date.now();

    return (
      <div className="parent-mode parent-mode--gate">
        <div className="parent-mode__gate-card">
          <h2>Parent Mode</h2>
          <p>Solve this math question to continue.</p>

          <form onSubmit={submitMathAnswer} className="parent-mode__gate-form">
            <label htmlFor="parent-math-answer">{mathProblem.text} = ?</label>
            <input
              id="parent-math-answer"
              value={mathAnswer}
              onChange={(e) => setMathAnswer(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              disabled={isLocked}
            />
            <button type="submit" disabled={isLocked}>Unlock</button>
          </form>

          {isLocked ? (
            <p className="parent-mode__warning">
              Too many attempts. Try again in {secondsLeft}s.
            </p>
          ) : (
            <p className="parent-mode__hint">Attempts left: {3 - failedAttempts}</p>
          )}

          <button className="parent-mode__link" type="button" onClick={handleCancel}>
            Back to child mode
          </button>
        </div>
      </div>
    );
  }

  const filteredCategoryAddItems = allItems.filter(({ id, label }) => {
    if (!editingCategory) return false;
    if (editingCategory.items.includes(id)) return false;

    const q = itemSearch.trim().toLowerCase();
    if (!q) return true;

    return id.toLowerCase().includes(q) || label.toLowerCase().includes(q);
  });

  return (
    <div className="parent-mode">
      <header className="parent-mode__header">
        <h2>Parent Mode</h2>
        <div className="parent-mode__header-actions">
          <button type="button" onClick={handleClearSettings} className="parent-mode__button parent-mode__button--ghost">
            Clear settings
          </button>
          <button type="button" onClick={handleCancel} className="parent-mode__button parent-mode__button--ghost">
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="parent-mode__button parent-mode__button--primary">
            Confirm
          </button>
        </div>
      </header>

      <div className="parent-mode__body">
        <section className="parent-mode__panel">
          <h3>Category Management</h3>
          <ul className="parent-mode__list">
            {editorManagedCategories.map((category, index) => {
              const hidden = (draft.hiddenCategories || []).includes(category.id);
              const isKeyWords = category.id === KEY_WORDS_CATEGORY_ID;

              return (
                <li key={category.id} className="parent-mode__list-row">
                  <span>{category.name}</span>
                  {isKeyWords ? (
                    <span className="parent-mode__meta-text">Always visible</span>
                  ) : (
                    <label>
                      <input
                        type="checkbox"
                        checked={!hidden}
                        onChange={() => toggleCategoryVisibility(category.id)}
                      />
                      Visible
                    </label>
                  )}
                  <div className="parent-mode__row-actions">
                    <button
                      type="button"
                      onClick={() => openEditCategoryModal(category.id)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCategory(category.id, -1)}
                      disabled={isKeyWords || index === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCategory(category.id, 1)}
                      disabled={isKeyWords || index === editorManagedCategories.length - 1}
                    >
                      ↓
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="parent-mode__section-actions">
            <button type="button" onClick={openCreateCategoryModal}>+ New Category</button>
          </div>
        </section>

      </div>

      {isCreateCategoryOpen && (
        <div className="parent-mode__modal-backdrop" role="dialog" aria-modal="true" aria-label="Create category">
          <div className="parent-mode__modal-card">
            <h3>Create Category</h3>
            <div className="parent-mode__inline-form">
              <input
                type="text"
                value={pendingCategoryName}
                onChange={(e) => setPendingCategoryName(e.target.value)}
                placeholder="Category name"
                autoFocus
              />
            </div>
            <div className="parent-mode__inline-form">
              <button type="button" onClick={cancelCreateCategoryModal}>Cancel</button>
              <button type="button" onClick={createCategory} disabled={!pendingCategoryName.trim()}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditCategoryOpen && editingCategory && (
        <div className="parent-mode__modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit category">
          <div className="parent-mode__modal-card parent-mode__modal-card--editor">
            <div className="parent-mode__modal-header">
              <h3>Edit {editingCategory.name}</h3>
              <button type="button" onClick={closeEditCategoryModal}>Done</button>
            </div>

            <div
              className="parent-mode__visual-editor"
              style={{ '--parent-preview-bg': editingCategory.color || '#f3f6fb' }}
            >
              <div className="parent-mode__visual-grid">
                {editingCategory.items.map((itemId, index) => {
                  const item = baseConfig.items[itemId];
                  if (!item) return null;

                  const isHidden = hiddenItemSet.has(itemId);
                  const isDragging = draggedItemId === itemId;
                  const isDragOver = dragOverItemId === itemId;

                  return (
                    <div
                      key={itemId}
                      className={`parent-mode__tile${isDragging ? ' parent-mode__tile--dragging' : ''}${
                        isDragOver ? ' parent-mode__tile--dragover' : ''
                      }`}
                      draggable
                      onDragStart={(event) => {
                        setDraggedItemId(itemId);
                        setOpenItemMenuId('');
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', itemId);
                      }}
                      onDragOver={(event) => {
                        if (!draggedItemId || draggedItemId === itemId) return;
                        event.preventDefault();
                        setDragOverItemId(itemId);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (!draggedItemId || draggedItemId === itemId) return;
                        reorderCategoryItemsByDrop(editingCategory.id, draggedItemId, itemId);
                        setDraggedItemId('');
                        setDragOverItemId('');
                      }}
                      onDragEnd={() => {
                        setDraggedItemId('');
                        setDragOverItemId('');
                      }}
                    >
                      <button
                        type="button"
                        className="parent-mode__tile-menu-trigger"
                        onClick={() => setOpenItemMenuId((prev) => (prev === itemId ? '' : itemId))}
                        aria-label={`Actions for ${item.label}`}
                      >
                        ⋯
                      </button>

                      {openItemMenuId === itemId && (
                        <div className="parent-mode__tile-menu" role="menu">
                          <button
                            type="button"
                            onClick={() => {
                              toggleItemHidden(itemId);
                              setOpenItemMenuId('');
                            }}
                          >
                            {isHidden ? 'Unhide everywhere' : 'Hide everywhere'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              removeItemFromCategory(editingCategory.id, itemId);
                              setOpenItemMenuId('');
                            }}
                          >
                            Remove from this category
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              moveCategoryItem(editingCategory.id, itemId, -1);
                              setOpenItemMenuId('');
                            }}
                            disabled={index === 0}
                          >
                            Move up
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              moveCategoryItem(editingCategory.id, itemId, 1);
                              setOpenItemMenuId('');
                            }}
                            disabled={index === editingCategory.items.length - 1}
                          >
                            Move down
                          </button>
                        </div>
                      )}

                      <div className="parent-mode__tile-image-wrap">
                        <img src={item.image} alt="" className="parent-mode__tile-image" />
                      </div>
                      <span className="parent-mode__tile-label">{item.label}</span>
                      {isHidden && <span className="parent-mode__tile-badge">Hidden</span>}
                    </div>
                  );
                })}

                <button
                  type="button"
                  className="parent-mode__tile parent-mode__tile--add"
                  onClick={openAddItemsPicker}
                >
                  <span className="parent-mode__tile-plus">＋</span>
                  <span className="parent-mode__tile-label">Add item</span>
                </button>
              </div>
            </div>

            {isAddItemsOpen && (
              <div className="parent-mode__add-picker">
                <div className="parent-mode__inline-form">
                  <input
                    type="search"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Search all items to add"
                  />
                </div>

                <ul className="parent-mode__list parent-mode__list--compact">
                  {filteredCategoryAddItems.map(({ id, label }) => (
                    <li key={id} className="parent-mode__list-row">
                      <label className="parent-mode__checkbox-row">
                        <input
                          type="checkbox"
                          checked={pendingCategoryItems.includes(id)}
                          onChange={() => togglePendingCategoryItem(id)}
                        />
                        <span>
                          {label}
                          {hiddenItemSet.has(id) ? ' (hidden globally)' : ''}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>

                <div className="parent-mode__inline-form">
                  <button type="button" onClick={cancelAddItemsPicker}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmAddItems}
                    disabled={!pendingCategoryItems.length}
                  >
                    Add Selected ({pendingCategoryItems.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
