import React, { useState, useEffect, useRef } from 'react';
import SchemeCard from './SchemeCard';

const LazyGrid = ({ items, showCategoryBadge, isArchivedMode, activeAudience, forceAllItems = false }) => {
    const [visibleCount, setVisibleCount] = useState(12);
    const observerTarget = useRef(null);

    useEffect(() => {
        if (forceAllItems) {
            setVisibleCount(items.length);
            return undefined;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && visibleCount < items.length) {
                    setVisibleCount(prev => Math.min(prev + 12, items.length));
                }
            },
            { threshold: 0.1, rootMargin: '200px' }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => {
            if (observerTarget.current) observer.unobserve(observerTarget.current);
        };
    }, [forceAllItems, visibleCount, items.length]);

    // Reset visible count when items change (e.g. search/filter)
    useEffect(() => {
        setVisibleCount(forceAllItems ? items.length : 12);
    }, [forceAllItems, items]);

    const visibleItems = forceAllItems ? items : items.slice(0, visibleCount);

    return (
        <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleItems.map((scheme, i) => (
                    <SchemeCard
                        key={`${scheme.id || i}`}
                        scheme={scheme}
                        showCategoryBadge={showCategoryBadge}
                        isArchivedMode={isArchivedMode}
                        activeAudience={activeAudience}
                    />
                ))}
            </div>
            {!forceAllItems && visibleCount < items.length && (
                <div ref={observerTarget} className="h-20 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                </div>
            )}
        </div>
    );
};

export default LazyGrid;
