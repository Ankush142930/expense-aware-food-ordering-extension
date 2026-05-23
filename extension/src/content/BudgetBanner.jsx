import { useState, useEffect } from 'react';
import './content.css';

const DEFAULT_BUDGET = 2200;

export default function BudgetBanner() {
    const [data, setData] = useState({
        cartTotal: 420,  // TODO: replace mock data with real data
        monthlyBudget: DEFAULT_BUDGET,
        spentSoFar: 1200, // TODO: replace mock data with real data
        loading: false,
        error: null,
    })

    // Load budget setting from chrome.storage.sync
    useEffect(() => {
        if(typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.sync.get(['monthlyBudget'], (result) => {
                if(result.monthlyBudget) {
                    setData(prev => ({ ...prev, monthlyBudget: result.monthlyBudget }));
                }
            });
        }
    }, []);

    const { cartTotal, monthlyBudget, spentSoFar, loading, error } = data;
    const remaining = monthlyBudget - spentSoFar;
    const afterOrder = remaining - cartTotal;
    const percentUsed = Math.min(((spentSoFar + cartTotal) / monthlyBudget) * 100, 100);

    const state = afterOrder > monthlyBudget * 0.4 ? 'safe' 
                  : afterOrder > monthlyBudget * 0.1 ? 'warning' 
                  : 'critical';

    // State configuration for the banner
    const stateConfig = {
        safe: { icon: '✅', label: 'Within Budget', color: '#22c55e' },
        warning: { icon: '⚠️', label: 'Budget Running Low', color: '#f59e0b' },
        critical: { icon: '🔴', label: 'Budget Exceeded', color: '#ef4444' },
    };

    if(loading) return <div className="bb-banner bb-loading">Loading budget data…</div>;
    if(error) return <div className="bb-banner bb-error">⚠️ Could not load budget data</div>;

    return (
        <div className={`bb-banner bb-${state}`}>
            <div className="bb-header">
                <span className="bb-icon">{stateConfig[state].icon}</span>
                <span className="bb-label">{stateConfig[state].label}</span>
                <span className="bb-powered">BudgetBite</span>
            </div>

            <div className="bb-body">
                <div className="bb-row">
                    <span>This order</span>
                    <span className="bb-amount">₹ {cartTotal}</span>
                </div>
                <div className="bb-row">
                    <span>Spent this month</span>
                    <span className="bb-amount">₹ {spentSoFar}</span>
                </div>
                <div className="bb-row bb-row--highlight">
                    <span>Remaining after order</span>
                    <span className="bb-amount" style={{ color: stateConfig[state].color }}>
                        {afterOrder >= 0 ? `₹${afterOrder}` : `-₹${Math.abs(afterOrder)}`}
                    </span>
                </div>
            </div>
            <div className="bb-progress">
                <div 
                    className="bb-progress-bar"
                    style={{ width: `${percentUsed}%`, background: stateConfig[state].color }}
                />
            </div>
            <div className="bb-progress-label">
                {Math.round(percentUsed)}% of ₹{monthlyBudget} monthly budget used after this order
            </div>
        </div>
    );
}

