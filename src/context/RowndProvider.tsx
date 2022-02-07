import React, { useContext, createContext, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';

import HubScriptInjector from './HubScriptInjector';
import { TRowndContext } from './types';

const RowndContext = createContext<TRowndContext | undefined>(undefined);

type HubListenerProps = {
    state: any;
    api: any;
}

type RowndProviderProps = {
    appKey: string;
    apiUrl?: string;
    rootOrigin?: string;
    children: React.ReactNode;
}

function RowndProvider({ appKey, apiUrl, rootOrigin, children }: RowndProviderProps) {
    
    const hubApi = useRef<{[key: string]: any} | null>(null);
    const apiQueue = useRef<{ fnName: string, args: any[]}[]>([]);
    
    let callHubApi = useCallback((fnName: string, ...args: any[]) => {
        if (hubApi.current?.[fnName]) {
            return hubApi.current[fnName](...args);
        }

        apiQueue.current.push({ fnName, args });
    }, [hubApi]);

    let requestSignIn = useCallback((...args: any[]) => callHubApi('requestSignIn', ...args), [callHubApi]);
    let getAccessToken = useCallback((...args: any[]) => callHubApi('getAccessToken', ...args), [callHubApi]);
    let signOut = useCallback((...args: any[]) => callHubApi('signOut', ...args), [callHubApi]);

    let [hubState, setHubState] = React.useState<TRowndContext>({
        requestSignIn,
        getAccessToken,
        signOut,
        is_initializing: true,
        is_authenticated: false,
        access_token: null,
        auth: {
            access_token: null,
            is_authenticated: false,
        },
        user: {
            data: {},
            redacted_fields: [],
        }
    });

    const flushApiQueue = useCallback(() => {
        // Flush the call stack if needed
        if (!apiQueue.current.length) {
            return;
        }

        for (let { fnName, args } of apiQueue.current) {
            if (!hubApi.current?.[fnName]) {
                return;
            }

            hubApi.current[fnName](...args);
        }

        apiQueue.current.length = 0;
    }, [apiQueue]);

    let hubListenerCb = useCallback(({ state, api }: HubListenerProps) => {
        let transformedState: TRowndContext = {
            // functions
            requestSignIn,
            getAccessToken,
            signOut,

            // data
            is_initializing: state.is_initializing,
            is_authenticated: !!state.auth?.access_token,
            access_token: state.auth?.access_token || null,
            auth: {
                access_token: state.auth?.access_token,
                app_id: state.auth?.app_id,
                is_authenticated: !!state.auth?.access_token
            },
            user: {
                ...state.user
            }
        };

        setHubState(transformedState);
        hubApi.current = api;

        flushApiQueue();
    }, [flushApiQueue, getAccessToken, requestSignIn]);

    console.log('rph_txstate:', hubState);

    return (
        <RowndContext.Provider value={hubState}>
            <HubScriptInjector 
                appKey={appKey}
                apiUrl={apiUrl}
                stateListener={hubListenerCb} 
                rootOrigin={rootOrigin}
            />
            {children}
        </RowndContext.Provider>
    );
}

RowndProvider.propTypes = {
    appKey: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
};

function useRownd(): TRowndContext {
    const context = useContext(RowndContext);

    if (context === undefined) {
        throw new Error('useRownd must be used within a RowndProvider');
    }

    return context;
}

export { RowndProvider, useRownd };