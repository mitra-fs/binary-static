import extend          from 'extend';
import { runInAction } from 'mobx';
import Client          from '../../../../_common/base/client_base';
import {
    cloneObject,
    isEmptyObject }    from '../../../../_common/utility';
import URLHelper       from '../../../common/url_helper';

import ContractTypeHelper  from './helpers/contract_type';
import { requestProposal } from './helpers/proposal';

// add files containing actions here.
import * as ContractType  from './contract_type';
import * as Currency      from './currency';
import * as Duration      from './duration';
import * as StartDate     from './start_date';
import * as Symbol        from './symbol';

// list of trade's options that should be used in querstring of trade page url.
export const queryStringVariables = [
    'amount', 'barrier_1', 'barrier_2', 'basis', 
    'contract_start_type', 'contract_type', 
    'contract_type', 'currency', 'duration', 
    'duration_unit', 'expiry_date', 'expiry_type', 
    'last_digit', 'start_date', 'symbol',
];

export const updateStore = async(store, obj_new_values = {}, is_by_user) => {
    const new_state = cloneObject(obj_new_values);
    runInAction(() => {
        Object.keys(new_state).forEach((key) => {
            if (JSON.stringify(store[key]) === JSON.stringify(new_state[key])) {
                delete new_state[key];
            } else {
                if (key === 'symbol') {
                    store.is_purchase_enabled = false;
                    store.is_trade_enabled    = false;
                }

                // TODO move to proper file or place
                // Add changes to queryString of the url
                if (queryStringVariables.indexOf(key) !== -1) {
                    URLHelper.setQueryParam({ [key]: new_state[key] });
                }

                store[key] = new_state[key];
            }
        });
    });

    if (is_by_user || /^(symbol|contract_types_list)$/.test(Object.keys(new_state))) {
        if ('symbol' in new_state) {
            await Symbol.onChangeSymbolAsync(new_state.symbol);
        }
        process(store);
    }
};

const process_methods = [
    ContractTypeHelper.getContractCategories,
    ContractType.onChangeContractTypeList,
    ContractType.onChangeContractType,
    Duration.onChangeExpiry,
    StartDate.onChangeStartDate,
];
const process = async(store) => {
    updateStore(store, { is_purchase_enabled: false, proposal_info: {} }); // disable purchase button(s), clear contract info

    const snapshot = cloneObject(store);

    if (!Client.get('currency') && isEmptyObject(store.currencies_list)) {
        extendOrReplace(snapshot, await Currency.getCurrenciesAsync(store.currency));
    }

    process_methods.forEach((fnc) => {
        extendOrReplace(snapshot, fnc(snapshot));
    });

    snapshot.is_trade_enabled = true;
    updateStore(store, snapshot);

    requestProposal(store, updateStore);
};

// Some values need to be replaced, not extended
const extendOrReplace = (source, new_values) => {
    const to_replace = ['contract_types_list', 'trade_types'];

    to_replace.forEach((key) => {
        if (key in new_values) {
            source[key] = undefined;
        }
    });

    extend(true, source, new_values);
};
