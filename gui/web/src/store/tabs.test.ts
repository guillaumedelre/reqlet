import { beforeEach, describe, expect, it } from 'vitest';
import { useTabsStore } from './tabs';
import type { Collection, Environment, FolderItem, RequestItem } from '@/types';

function req(id = 'req-1', name = 'My Request'): RequestItem {
  return {
    id, name, method: 'GET', url: 'https://example.com',
    params: [], headers: [],
    body: { type: 'none', raw: '', rawContentType: 'application/json', formData: [], urlencoded: [], graphqlQuery: '', graphqlVariables: '' },
    auth: { type: 'none' }, preRequestScript: '', testScript: '',
  };
}
function env(id = 'env-1'): Environment { return { id, name: 'Dev', variables: [] }; }
function col(id = 'col-1'): Collection { return { id, name: 'My Col', description: '', auth: { type: 'none' }, variables: [], preRequestScript: '', testScript: '', items: [] }; }
function folder(id = 'fold-1'): FolderItem { return { id, name: 'My Folder', auth: { type: 'none' }, preRequestScript: '', testScript: '', items: [] }; }

beforeEach(() => {
  useTabsStore.setState({ tabs: [], activeTabId: '', closedTabs: [] });
  localStorage.clear();
});

// ── openNewTab ─────────────────────────────────────────────────────────────

describe('openNewTab', () => {
  it('adds a blank request tab and makes it active', () => {
    useTabsStore.getState().openNewTab();
    const { tabs, activeTabId } = useTabsStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].type).toBe('request');
    expect(tabs[0].title).toBe('New Request');
    expect(activeTabId).toBe(tabs[0].id);
  });

  it('always creates a new tab (no deduplication)', () => {
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    expect(useTabsStore.getState().tabs).toHaveLength(2);
  });
});

// ── openRequestTab ─────────────────────────────────────────────────────────

describe('openRequestTab', () => {
  it('creates a request tab with correct metadata', () => {
    useTabsStore.getState().openRequestTab(req());
    const { tabs, activeTabId } = useTabsStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].type).toBe('request');
    expect(tabs[0].requestId).toBe('req-1');
    expect(tabs[0].title).toBe('My Request');
    expect(activeTabId).toBe(tabs[0].id);
  });

  it('reuses existing tab for the same requestId', () => {
    useTabsStore.getState().openRequestTab(req());
    const { tabs: [first] } = useTabsStore.getState();
    useTabsStore.getState().openRequestTab(req());
    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().tabs[0].id).toBe(first.id);
  });

  it('opens separate tabs for different requestIds', () => {
    useTabsStore.getState().openRequestTab(req('req-1'));
    useTabsStore.getState().openRequestTab(req('req-2'));
    expect(useTabsStore.getState().tabs).toHaveLength(2);
  });

  it('copies request fields into the tab request state', () => {
    const r = req('req-1', 'Login');
    r.method = 'POST';
    r.url = 'https://api.example.com/login';
    useTabsStore.getState().openRequestTab(r);
    const { request } = useTabsStore.getState().tabs[0];
    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://api.example.com/login');
  });
});

// ── openEnvironmentTab ─────────────────────────────────────────────────────

describe('openEnvironmentTab', () => {
  it('creates an environment tab', () => {
    useTabsStore.getState().openEnvironmentTab(env());
    const { tabs, activeTabId } = useTabsStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].type).toBe('environment');
    expect(tabs[0].environmentId).toBe('env-1');
    expect(activeTabId).toBe(tabs[0].id);
  });

  it('reuses existing tab for the same environmentId', () => {
    useTabsStore.getState().openEnvironmentTab(env());
    const id1 = useTabsStore.getState().tabs[0].id;
    useTabsStore.getState().openEnvironmentTab(env());
    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().tabs[0].id).toBe(id1);
  });

  it('opens separate tabs for different environmentIds', () => {
    useTabsStore.getState().openEnvironmentTab(env('env-1'));
    useTabsStore.getState().openEnvironmentTab(env('env-2'));
    expect(useTabsStore.getState().tabs).toHaveLength(2);
  });
});

// ── openGlobalsTab ─────────────────────────────────────────────────────────

describe('openGlobalsTab', () => {
  it('creates a globals tab with title "Globals"', () => {
    useTabsStore.getState().openGlobalsTab();
    const { tabs } = useTabsStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].type).toBe('globals');
    expect(tabs[0].title).toBe('Globals');
  });

  it('is a singleton: reuses the same tab', () => {
    useTabsStore.getState().openGlobalsTab();
    const id1 = useTabsStore.getState().tabs[0].id;
    useTabsStore.getState().openGlobalsTab();
    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().tabs[0].id).toBe(id1);
  });
});

// ── openCollectionTab ──────────────────────────────────────────────────────

describe('openCollectionTab', () => {
  it('creates a collection tab', () => {
    useTabsStore.getState().openCollectionTab(col());
    const { tabs } = useTabsStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].type).toBe('collection');
    expect(tabs[0].collectionId).toBe('col-1');
    expect(tabs[0].title).toBe('My Col');
  });

  it('reuses existing collection tab', () => {
    useTabsStore.getState().openCollectionTab(col());
    const id1 = useTabsStore.getState().tabs[0].id;
    useTabsStore.getState().openCollectionTab(col());
    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().tabs[0].id).toBe(id1);
  });
});

// ── openFolderTab ──────────────────────────────────────────────────────────

describe('openFolderTab', () => {
  it('creates a folder tab with collectionId', () => {
    useTabsStore.getState().openFolderTab(folder(), 'col-1');
    const { tabs } = useTabsStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].type).toBe('folder');
    expect(tabs[0].folderId).toBe('fold-1');
    expect(tabs[0].collectionId).toBe('col-1');
  });

  it('reuses existing folder tab', () => {
    useTabsStore.getState().openFolderTab(folder(), 'col-1');
    const id1 = useTabsStore.getState().tabs[0].id;
    useTabsStore.getState().openFolderTab(folder(), 'col-1');
    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().tabs[0].id).toBe(id1);
  });
});

// ── closeTab ───────────────────────────────────────────────────────────────

describe('closeTab', () => {
  it('removes the specified tab', () => {
    useTabsStore.getState().openNewTab();
    const { tabs: [tab] } = useTabsStore.getState();
    useTabsStore.getState().closeTab(tab.id);
    expect(useTabsStore.getState().tabs.find(t => t.id === tab.id)).toBeUndefined();
  });

  it('creates a blank tab when closing the last one', () => {
    useTabsStore.getState().openNewTab();
    const tabId = useTabsStore.getState().tabs[0].id;
    useTabsStore.getState().closeTab(tabId);
    const { tabs } = useTabsStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].type).toBe('request');
    expect(tabs[0].id).not.toBe(tabId);
  });

  it('adds the closed tab to closedTabs', () => {
    useTabsStore.getState().openNewTab();
    const tabId = useTabsStore.getState().tabs[0].id;
    useTabsStore.getState().closeTab(tabId);
    expect(useTabsStore.getState().closedTabs[0].id).toBe(tabId);
  });

  it('activates the next tab when closing the active tab', () => {
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    const [first, second] = useTabsStore.getState().tabs;
    useTabsStore.setState({ activeTabId: first.id });
    useTabsStore.getState().closeTab(first.id);
    expect(useTabsStore.getState().activeTabId).toBe(second.id);
  });

  it('keeps activeTabId when closing an inactive tab', () => {
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    const [first, second] = useTabsStore.getState().tabs;
    useTabsStore.setState({ activeTabId: second.id });
    useTabsStore.getState().closeTab(first.id);
    expect(useTabsStore.getState().activeTabId).toBe(second.id);
  });

  it('caps closedTabs at 10 entries', () => {
    for (let i = 0; i < 12; i++) {
      useTabsStore.getState().openNewTab();
    }
    const ids = useTabsStore.getState().tabs.slice(0, 11).map(t => t.id);
    for (const id of ids) {
      useTabsStore.getState().closeTab(id);
    }
    expect(useTabsStore.getState().closedTabs.length).toBeLessThanOrEqual(10);
  });
});

// ── duplicateTab ───────────────────────────────────────────────────────────

describe('duplicateTab', () => {
  it('inserts the copy right after the original', () => {
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    const [a, b] = useTabsStore.getState().tabs;
    useTabsStore.getState().duplicateTab(a.id);
    const { tabs } = useTabsStore.getState();
    expect(tabs).toHaveLength(3);
    expect(tabs[0].id).toBe(a.id);
    expect(tabs[2].id).toBe(b.id);
  });

  it('gives the duplicate a new id', () => {
    useTabsStore.getState().openNewTab();
    const orig = useTabsStore.getState().tabs[0];
    useTabsStore.getState().duplicateTab(orig.id);
    expect(useTabsStore.getState().tabs[1].id).not.toBe(orig.id);
  });

  it('resets dirty flag on the duplicate', () => {
    useTabsStore.getState().openNewTab();
    const orig = useTabsStore.getState().tabs[0];
    useTabsStore.getState().updateTab(orig.id, { dirty: true });
    useTabsStore.getState().duplicateTab(orig.id);
    expect(useTabsStore.getState().tabs[1].dirty).toBe(false);
  });

  it('makes the duplicate the active tab', () => {
    useTabsStore.getState().openNewTab();
    const orig = useTabsStore.getState().tabs[0];
    useTabsStore.getState().duplicateTab(orig.id);
    expect(useTabsStore.getState().activeTabId).toBe(useTabsStore.getState().tabs[1].id);
  });
});

// ── closeOtherTabs ─────────────────────────────────────────────────────────

describe('closeOtherTabs', () => {
  it('is a no-op when tab id does not exist', () => {
    useTabsStore.getState().openNewTab();
    const before = useTabsStore.getState().tabs.length;
    useTabsStore.getState().closeOtherTabs('nonexistent');
    expect(useTabsStore.getState().tabs).toHaveLength(before);
  });

  it('keeps only the specified tab', () => {
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    const kept = useTabsStore.getState().tabs[1].id;
    useTabsStore.getState().closeOtherTabs(kept);
    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().tabs[0].id).toBe(kept);
  });

  it('adds closed tabs to closedTabs', () => {
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    const kept = useTabsStore.getState().tabs[0].id;
    useTabsStore.getState().closeOtherTabs(kept);
    expect(useTabsStore.getState().closedTabs).toHaveLength(1);
  });

  it('makes the kept tab active', () => {
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    const kept = useTabsStore.getState().tabs[0].id;
    useTabsStore.getState().closeOtherTabs(kept);
    expect(useTabsStore.getState().activeTabId).toBe(kept);
  });
});

// ── closeTabsToRight ───────────────────────────────────────────────────────

describe('closeTabsToRight', () => {
  it('is a no-op when tab id does not exist', () => {
    useTabsStore.getState().openNewTab();
    const before = useTabsStore.getState().tabs.length;
    useTabsStore.getState().closeTabsToRight('nonexistent');
    expect(useTabsStore.getState().tabs).toHaveLength(before);
  });

  it('removes tabs to the right', () => {
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    const [a] = useTabsStore.getState().tabs;
    useTabsStore.getState().closeTabsToRight(a.id);
    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().tabs[0].id).toBe(a.id);
  });

  it('is a no-op when there are no tabs to the right', () => {
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    const last = useTabsStore.getState().tabs[1].id;
    useTabsStore.getState().closeTabsToRight(last);
    expect(useTabsStore.getState().tabs).toHaveLength(2);
  });

  it('switches active tab when active tab is to the right', () => {
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    const [a, , c] = useTabsStore.getState().tabs;
    useTabsStore.setState({ activeTabId: c.id });
    useTabsStore.getState().closeTabsToRight(a.id);
    expect(useTabsStore.getState().activeTabId).toBe(a.id);
  });
});

// ── reorderTabs ────────────────────────────────────────────────────────────

describe('reorderTabs', () => {
  it('moves a tab from index 0 to index 2', () => {
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    const [a, b, c] = useTabsStore.getState().tabs.map(t => t.id);
    useTabsStore.getState().reorderTabs(0, 2);
    expect(useTabsStore.getState().tabs.map(t => t.id)).toEqual([b, c, a]);
  });

  it('is a no-op when from === to', () => {
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    const before = useTabsStore.getState().tabs.map(t => t.id);
    useTabsStore.getState().reorderTabs(0, 0);
    expect(useTabsStore.getState().tabs.map(t => t.id)).toEqual(before);
  });
});

// ── reopenLastClosedTab ────────────────────────────────────────────────────

describe('reopenLastClosedTab', () => {
  it('does nothing when no closed tabs', () => {
    useTabsStore.getState().openNewTab();
    const count = useTabsStore.getState().tabs.length;
    useTabsStore.getState().reopenLastClosedTab();
    expect(useTabsStore.getState().tabs).toHaveLength(count);
  });

  it('restores the closed tab with a new id', () => {
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    const [a] = useTabsStore.getState().tabs;
    useTabsStore.getState().closeTab(a.id);
    useTabsStore.getState().reopenLastClosedTab();
    const { tabs } = useTabsStore.getState();
    expect(tabs).toHaveLength(2);
    expect(tabs.find(t => t.id === a.id)).toBeUndefined();
    expect(tabs.find(t => t.title === a.title)).toBeDefined();
  });

  it('removes the entry from closedTabs after reopening', () => {
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    const [a] = useTabsStore.getState().tabs;
    useTabsStore.getState().closeTab(a.id);
    useTabsStore.getState().reopenLastClosedTab();
    expect(useTabsStore.getState().closedTabs).toHaveLength(0);
  });
});

// ── updateTab ──────────────────────────────────────────────────────────────

describe('updateTab', () => {
  it('patches title and dirty flag', () => {
    useTabsStore.getState().openNewTab();
    const id = useTabsStore.getState().tabs[0].id;
    useTabsStore.getState().updateTab(id, { title: 'Renamed', dirty: true });
    const tab = useTabsStore.getState().tabs[0];
    expect(tab.title).toBe('Renamed');
    expect(tab.dirty).toBe(true);
  });

  it('does not affect other tabs', () => {
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    const [a, b] = useTabsStore.getState().tabs;
    useTabsStore.getState().updateTab(a.id, { title: 'Changed' });
    expect(useTabsStore.getState().tabs.find(t => t.id === b.id)?.title).toBe('New Request');
  });
});

// ── updateTabRequest ───────────────────────────────────────────────────────

describe('updateTabRequest', () => {
  it('updates request fields and marks tab dirty', () => {
    useTabsStore.getState().openNewTab();
    const id = useTabsStore.getState().tabs[0].id;
    useTabsStore.getState().updateTabRequest(id, r => ({ ...r, url: 'https://new.example.com', method: 'POST' }));
    const tab = useTabsStore.getState().tabs[0];
    expect(tab.request.url).toBe('https://new.example.com');
    expect(tab.request.method).toBe('POST');
    expect(tab.dirty).toBe(true);
  });
});

// ── sub-tab setters ────────────────────────────────────────────────────────

describe('setTabSubTab', () => {
  it('changes the requestSubTab', () => {
    useTabsStore.getState().openNewTab();
    const id = useTabsStore.getState().tabs[0].id;
    useTabsStore.getState().setTabSubTab(id, 'headers');
    expect(useTabsStore.getState().tabs[0].requestSubTab).toBe('headers');
  });
});

describe('setTabResponseSubTab', () => {
  it('changes the responseSubTab', () => {
    useTabsStore.getState().openNewTab();
    const id = useTabsStore.getState().tabs[0].id;
    useTabsStore.getState().setTabResponseSubTab(id, 'headers');
    expect(useTabsStore.getState().tabs[0].responseSubTab).toBe('headers');
  });
});

describe('setTabCollectionSubTab', () => {
  it('changes the collectionSubTab', () => {
    useTabsStore.getState().openCollectionTab(col());
    const id = useTabsStore.getState().tabs[0].id;
    useTabsStore.getState().setTabCollectionSubTab(id, 'variables');
    expect(useTabsStore.getState().tabs[0].collectionSubTab).toBe('variables');
  });
});

// ── setActiveTab ───────────────────────────────────────────────────────────

describe('setActiveTab', () => {
  it('changes the active tab', () => {
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    const [a, b] = useTabsStore.getState().tabs;
    useTabsStore.setState({ activeTabId: a.id });
    useTabsStore.getState().setActiveTab(b.id);
    expect(useTabsStore.getState().activeTabId).toBe(b.id);
  });
});

// ── closeTab extra branches ────────────────────────────────────────────────

describe('closeTab extra branches', () => {
  it('is graceful when tab id does not exist (closedTabs stays unchanged)', () => {
    useTabsStore.getState().openNewTab();
    const before = useTabsStore.getState().closedTabs.length;
    useTabsStore.getState().closeTab('does-not-exist');
    expect(useTabsStore.getState().closedTabs.length).toBe(before);
  });

  it('activates the last remaining tab when closing the last from the end', () => {
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    const tabs = useTabsStore.getState().tabs;
    const last = tabs[tabs.length - 1];
    useTabsStore.setState({ activeTabId: last.id });
    useTabsStore.getState().closeTab(last.id);
    const nowActive = useTabsStore.getState().activeTabId;
    const remaining = useTabsStore.getState().tabs;
    expect(remaining.find(t => t.id === nowActive)).toBeDefined();
  });
});

// ── closeTabsToRight extra branch ──────────────────────────────────────────

describe('closeTabsToRight — active tab is not in kept set', () => {
  it('switches active to the pivot when active tab is closed', () => {
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    const [a, b] = useTabsStore.getState().tabs;
    useTabsStore.setState({ activeTabId: b.id });
    useTabsStore.getState().closeTabsToRight(a.id);
    expect(useTabsStore.getState().activeTabId).toBe(a.id);
  });
});

// ── duplicateTab guard ─────────────────────────────────────────────────────

describe('duplicateTab guard', () => {
  it('is a no-op when tab id does not exist', () => {
    useTabsStore.getState().openNewTab();
    const before = useTabsStore.getState().tabs.length;
    useTabsStore.getState().duplicateTab('nonexistent');
    expect(useTabsStore.getState().tabs).toHaveLength(before);
  });
});

// ── map ternary branches: operations must not affect sibling tabs ──────────

describe('tab update operations do not affect sibling tabs', () => {
  it('updateTabRequest leaves sibling tab unchanged', () => {
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    const [a, b] = useTabsStore.getState().tabs;
    useTabsStore.getState().updateTabRequest(a.id, r => ({ ...r, url: 'https://changed.example.com' }));
    expect(useTabsStore.getState().tabs.find(t => t.id === b.id)!.request.url).toBe('');
  });

  it('setTabSubTab leaves sibling tab unchanged', () => {
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    const [a, b] = useTabsStore.getState().tabs;
    useTabsStore.getState().setTabSubTab(a.id, 'body');
    expect(useTabsStore.getState().tabs.find(t => t.id === b.id)!.requestSubTab).toBe('params');
  });

  it('setTabResponseSubTab leaves sibling tab unchanged', () => {
    useTabsStore.getState().openNewTab();
    useTabsStore.getState().openNewTab();
    const [a, b] = useTabsStore.getState().tabs;
    useTabsStore.getState().setTabResponseSubTab(a.id, 'headers');
    expect(useTabsStore.getState().tabs.find(t => t.id === b.id)!.responseSubTab).toBe('body');
  });

  it('setTabCollectionSubTab leaves sibling tab unchanged', () => {
    useTabsStore.getState().openCollectionTab(col());
    useTabsStore.getState().openCollectionTab({ ...col(), id: 'col-2', name: 'Second' });
    const [a, b] = useTabsStore.getState().tabs;
    useTabsStore.getState().setTabCollectionSubTab(a.id, 'variables');
    expect(useTabsStore.getState().tabs.find(t => t.id === b.id)!.collectionSubTab).toBe('overview');
  });
});
