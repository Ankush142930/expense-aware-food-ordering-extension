import { useState, useEffect } from 'react';

const DEFAULT_BUDGET = 2200;

export default function BudgetBanner() {
    const [data, setData] = useState({
        cartTotal: 280,
        monthlyBudget: DEFAULT_BUDGET,
        spentSoFar: 1200,
        loading: false,
        error: null,
    });

    useEffect(() => {
        if (typeof chrome === 'undefined' || !chrome.storage) return;

        chrome.storage.sync.get(['swiggyConnected', 'monthlyBudget'], (settings) => {
            if (settings.monthlyBudget) {
                setData((prev) => ({ ...prev, monthlyBudget: settings.monthlyBudget }));
            }

            if (!settings.swiggyConnected) {
                setData((prev) => ({ ...prev, loading: false }));
                return;
            }

            setData((prev) => ({ ...prev, loading: true, error: null }));

            chrome.runtime.sendMessage({ type: 'GET_CART' }, (cartResponse) => {
                if (chrome.runtime.lastError) {
                    setData((prev) => ({
                        ...prev,
                        loading: false,
                        error: chrome.runtime.lastError.message,
                    }));
                    return;
                }

                if (cartResponse?.reauth) {
                    setData((prev) => ({
                        ...prev,
                        loading: false,
                        error: 'Session expired — connect Swiggy in the extension popup',
                    }));
                    return;
                }

                chrome.runtime.sendMessage({ type: 'GET_ORDERS' }, (ordersResponse) => {
                    if (chrome.runtime.lastError) {
                        setData((prev) => ({
                            ...prev,
                            loading: false,
                            error: chrome.runtime.lastError.message,
                        }));
                        return;
                    }

                    if (ordersResponse?.reauth) {
                        setData((prev) => ({
                            ...prev,
                            loading: false,
                            error: 'Session expired — connect Swiggy in the extension popup',
                        }));
                        return;
                    }

                    if (cartResponse?.success && ordersResponse?.success) {
                        setData((prev) => ({
                            ...prev,
                            loading: false,
                            error: null,
                            cartTotal: cartResponse.data?.total ?? prev.cartTotal,
                            spentSoFar: ordersResponse.data?.totalSpent ?? prev.spentSoFar,
                        }));
                    } else {
                        setData((prev) => ({
                            ...prev,
                            loading: false,
                            error:
                                cartResponse?.error ||
                                ordersResponse?.error ||
                                'Could not load budget data',
                        }));
                    }
                });
            });
        });
    }, []);

    const { cartTotal, monthlyBudget, spentSoFar, loading, error } = data;
    const remaining = monthlyBudget - spentSoFar;
    const afterOrder = remaining - cartTotal;
    const percentUsed = Math.min(((spentSoFar + cartTotal) / monthlyBudget) * 100, 100);

    const state =
        afterOrder > monthlyBudget * 0.4
            ? 'safe'
            : afterOrder > monthlyBudget * 0.1
              ? 'warning'
              : 'critical';

    const fmt = (n) => `₹${n}`;

    const stateConfig = {
        safe: {
            status: 'Within budget',
            message: 'This order keeps you within your monthly food budget',
        },
        warning: {
            status: 'Running low',
            message: 'You are close to your monthly food budget limit',
        },
        critical: {
            status: 'Over budget',
            message: 'This order may exceed your monthly food budget',
        },
    };

    if (loading) {
        return (
            <div className="bb-card bb-loading">
                <p className="bb-notice-body">Loading your budget details…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bb-card bb-error">
                <p className="bb-notice-title">Could not load budget details</p>
                <p className="bb-notice-body">{error}</p>
            </div>
        );
    }

    const { status, message } = stateConfig[state];
    const highlightValue =
        afterOrder >= 0 ? fmt(afterOrder) : `-${fmt(Math.abs(afterOrder))}`;

    return (
        <article className={`bb-card bb-${state}`} aria-label="Monthly food budget">
            <header className="bb-header">
                <span className="bb-logo" aria-hidden="true">🍽️</span>
                <div className="bb-brand">
                    <div className="bb-brand-name">BudgetBite</div>
                    <div className="bb-brand-sub">Expense-aware ordering</div>
                </div>
                <span className="bb-status">{status}</span>
            </header>

            <div className="bb-body">
                <p className="bb-message">{message}</p>

                <div className="bb-stats">
                    <div className="bb-stat">
                        <span className="bb-stat-value">{fmt(cartTotal)}</span>
                        <span className="bb-stat-label">This order</span>
                    </div>
                    <div className="bb-stat">
                        <span className="bb-stat-value">{fmt(spentSoFar)}</span>
                        <span className="bb-stat-label">Spent</span>
                    </div>
                    <div className="bb-stat bb-stat--highlight">
                        <span className="bb-stat-value">{highlightValue}</span>
                        <span className="bb-stat-label">After order</span>
                    </div>
                </div>

                <div
                    className="bb-progress-track"
                    role="progressbar"
                    aria-valuenow={percentUsed}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    <div className="bb-progress-fill" style={{ width: `${percentUsed}%` }} />
                </div>
                <p className="bb-progress-label">
                    {Math.round(percentUsed)}% of {fmt(monthlyBudget)} monthly budget used
                </p>
            </div>

            <footer className="bb-foot">
                <strong>Note:</strong> Budget is tracked from your extension settings
                {afterOrder < 0
                    ? ` — you may be ${fmt(Math.abs(afterOrder))} over after checkout.`
                    : ` — ${fmt(afterOrder)} remains after this order.`}
            </footer>
        </article>
    );
}
