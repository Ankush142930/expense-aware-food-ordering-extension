import { createRoot } from 'react-dom/client';
import BudgetBanner from './BudgetBanner';

const BANNER_ID = 'budgetbite-banner-root';

/**
 * Checks if the banner has already been mounted.
 * @returns {boolean} True if the banner has already been mounted, false otherwise.
 */
function isMountedAlready() {
    return document.getElementById(BANNER_ID) !== null;
}

/**
 * Gets the text of the page.
 * @returns {string} The text of the page.
 */
function getPageText() {
    return document.body?.innerText ?? '';
}

/**
 * Checks if the cart is empty.
 * @returns {boolean} True if the cart is empty, false otherwise.
 */
function isCartEmpty() {
    return getPageText().includes('Your cart is empty');
}

/**
 * Checks if the secure checkout text is present in the page text.
 * @returns {boolean} True if the secure checkout text is present, false otherwise.
 */
function hasCheckoutChrome() {
    return getPageText().includes('Secure Checkout');
}

/**
 * Checks if the order summary is present.
 * @returns {boolean} True if the order summary is present, false otherwise. => Checks the verified selectors first and then fallsback to text.
 */
function hasOrderSummary() {
    const text = getPageText();
    
    if(isCartEmpty()) return false;
    return (
        document.querySelector('._3tU6Q ._33IW5') !== null ||
        document.querySelector('._3tU6Q ._2eWt0') !== null ||
        text.includes('TO PAY') ||
        text.includes('Bill Details') ||
        text.includes('Item Total')
    );
}

/**
 * Checks if the current page is a checkout page.
 * @returns {boolean} True if the current page is a checkout page, false otherwise. => /cart fallback is also checked.
 */
function isCheckoutPage() {
    const path = window.location.pathname;
    
    if(!path.includes('/checkout') && !path.includes('/cart')) return false;
    return hasCheckoutChrome() || hasOrderSummary();
}

/**
 * Finds the injection anchor in the DOM.
 * @returns {Object | null} The injection anchor object if found, null otherwise.
 */
function findInjectionAnchor() {
    const toPayBlock = document.querySelector('._3tU6Q ._33IW5');
    if(toPayBlock?.parentNode) {
        return { parent: toPayBlock.parentNode, before: toPayBlock };
    }

    const billHeading = document.querySelector('._3tU6Q ._2eWt0');
    if(billHeading?.parentNode) {
        return { parent: billHeading.parentNode, before: billHeading };
    }

    const toPayEl = [...document.querySelectorAll('div, span')].find((el) =>
        /^TO PAY\b/i.test(el.textContent?.trim())
    );
    if(toPayEl?.parentNode) {
        return { parent: toPayEl.parentNode, before: toPayEl };
    }

    const summaryRoot = document.querySelector('._3tU6Q');
    if(summaryRoot?.firstElementChild) {
        return { parent: summaryRoot, before: summaryRoot.firstElementChild };
    }

    return null;
}

/**
 * Mounts the banner in the DOM.
 * @returns {void} Returns void if the banner is already mounted, the current page is not a checkout page, or the cart is empty.
 */
function mountBanner() {
    if(isMountedAlready() || !isCheckoutPage() || isCartEmpty()) return;

    const anchor = findInjectionAnchor();
    if(!anchor) return;

    const host = document.createElement('div');
    host.id = BANNER_ID;
    host.style.cssText = 'all: initial; display: block;';

    const shadow = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    shadow.appendChild(container);

    anchor.parent.insertBefore(host, anchor.before);

    const root = createRoot(container);
    root.render(<BudgetBanner />);
}

/**
 * Unmounts the banner from the DOM.
 * @returns {void} Returns void if the banner is not mounted.
 */
function unmountBanner() {
    const existing = document.getElementById(BANNER_ID);
    if(existing) existing.remove();
}

// Watch for DOM changes (SPA navigation)
const observer = new MutationObserver(() => {
    if(isCheckoutPage()) {
        mountBanner();
    } else {
        unmountBanner();
    }
});

observer.observe(document.body, { childList: true, subtree: true });

// Also try on initial load
mountBanner();