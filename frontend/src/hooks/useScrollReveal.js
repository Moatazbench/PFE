import { useEffect } from 'react';

const REVEAL_SELECTOR = [
  '.dash-card',
  '.ent-card',
  '.wm-stat-card',
  '.wm-panel-card',
  '.wm-kanban-column',
  '.activity-card',
  '.goals-feed-card',
  '.goals-table',
  '.eval-section',
  '.evaluation-card',
  '.validation-panel',
  '.ui-surface',
].join(',');

export default function useScrollReveal(rootRef, routeKey) {
  useEffect(function () {
    const root = rootRef.current;
    if (!root || typeof window === 'undefined') return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const registeredElements = new WeakSet();
    let revealIndex = 0;

    const revealObserver = reducedMotion || typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('ui-reveal--visible');
            revealObserver.unobserve(entry.target);
          });
        }, {
          root: null,
          rootMargin: '0px 0px -7% 0px',
          threshold: 0.08,
        });

    function registerElement(element) {
      if (!(element instanceof HTMLElement) || registeredElements.has(element)) return;

      registeredElements.add(element);
      element.classList.add('ui-reveal');
      element.style.setProperty('--ui-reveal-delay', Math.min(revealIndex % 6, 5) * 45 + 'ms');
      revealIndex += 1;

      if (reducedMotion || !revealObserver) {
        element.classList.add('ui-reveal--visible');
      } else {
        revealObserver.observe(element);
      }
    }

    function registerWithin(container) {
      if (!(container instanceof Element)) return;
      if (container.matches(REVEAL_SELECTOR)) registerElement(container);
      container.querySelectorAll(REVEAL_SELECTOR).forEach(registerElement);
    }

    registerWithin(root);

    const contentObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node instanceof Element) registerWithin(node);
        });
      });
    });

    contentObserver.observe(root, { childList: true, subtree: true });

    return function () {
      contentObserver.disconnect();
      if (revealObserver) revealObserver.disconnect();
    };
  }, [rootRef, routeKey]);
}
