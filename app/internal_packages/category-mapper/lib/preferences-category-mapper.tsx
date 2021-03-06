import React from 'react';
import {
  localized,
  AccountStore,
  CategoryStore,
  Category,
  Actions,
  ChangeRoleMappingTask,
  Folder,
} from 'mailspring-exports';

import CategorySelection from './category-selection';

const SELECTABLE_ROLES = ['inbox', 'sent', 'drafts', 'spam', 'archive', 'trash'];

interface State {
  assignments: {
    [accountId: string]: {
      [role: string]: Category;
    };
  };
  all: {
    [accountId: string]: Category[];
  };
  containerFolderDefault: string;
}

export default class PreferencesCategoryMapper extends React.Component<
  Record<string, unknown>,
  State
> {
  _unlisten?: () => void;

  constructor(props) {
    super(props);
    this.state = this._getStateFromStores();
  }

  componentDidMount() {
    this._unlisten = CategoryStore.listen(() => {
      this.setState(this._getStateFromStores());
    });
  }

  componentWillUnmount() {
    if (this._unlisten) {
      this._unlisten();
    }
  }

  _getStateFromStores() {
    const assignments = {};
    const all = {};

    for (const cat of CategoryStore.categories()) {
      all[cat.accountId] = all[cat.accountId] || [];
      all[cat.accountId].push(cat);
      if (SELECTABLE_ROLES.includes(cat.role)) {
        assignments[cat.accountId] = assignments[cat.accountId] || {};
        assignments[cat.accountId][cat.role] = cat;
      }
    }

    const containerFolderDefault = AccountStore.containerFolderDefaultGetter();
    return { assignments, all, containerFolderDefault };
  }

  _onCategorySelection = async (account, role, category) => {
    // our state will be updated as soon as the sync worker commits the change
    Actions.queueTask(
      new ChangeRoleMappingTask({
        role: role,
        path: category.path,
        accountId: account.id,
      })
    );
  };

  _updateContainerFolderDefault = () => {
    Actions.updateContainerFolderDefault(this.state.containerFolderDefault);
  }

  _renderRoleSection = (account, role) => {
    if (!account) return false;

    const assignments = this.state.assignments[account.id];
    if (!assignments) {
      // Account may not have completed an initial sync yet
      return false;
    }
    if (account.provider === 'gmail' && role === 'archive') {
      return false;
    }

    let all = this.state.all[account.id];
    const allowLabels = account.usesLabels() && role !== 'trash' && role !== 'spam';
    if (!allowLabels) all = all.filter(c => c instanceof Folder);

    return (
      <div className="role-section" key={`${account.id}-${role}`}>
        <div className="col-left">{Category.LocalizedStringForRole[role]}:</div>
        <div className="col-right">
          <CategorySelection
            all={all}
            current={assignments[role]}
            onSelect={category => this._onCategorySelection(account, role, category)}
            allowLabels={allowLabels}
          />
        </div>
      </div>
    );
  };

  render() {
    return (
      <div className="category-mapper-container">
        <h6>{localized('Default Container Folder (folder/subfolder)')}</h6>
        <input
          type="text"
          value={this.state.containerFolderDefault}
          onBlur={e => this._updateContainerFolderDefault()}
          onChange={e => this.setState({ containerFolderDefault: e.target.value })}
        />
        {AccountStore.accounts().map(account => (
          <div key={account.id}>
            <div className="account-section-title">{account.label}</div>
            {SELECTABLE_ROLES.map(role => this._renderRoleSection(account, role))}
          </div>
        ))}
      </div>
    );
  }
}
