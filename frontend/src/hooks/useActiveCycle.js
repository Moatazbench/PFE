import { useEffect, useState } from 'react';
import api from '../services/api';

function pickActiveCycle(cycles) {
    var items = Array.isArray(cycles) ? cycles : [];
    return items.find(function (cycle) {
        return cycle.status === 'in_progress' || cycle.status === 'active';
    }) || items.find(function (cycle) {
        return cycle.status !== 'draft';
    }) || null;
}

export default function useActiveCycle() {
    var [activeCycle, setActiveCycle] = useState(null);
    var [loading, setLoading] = useState(true);

    useEffect(function () {
        var cancelled = false;

        async function loadActiveCycle() {
            try {
                var res = await api.get('/cycles');
                if (!cancelled) {
                    setActiveCycle(pickActiveCycle(Array.isArray(res.data) ? res.data : []));
                }
            } catch (err) {
                if (!cancelled) {
                    setActiveCycle(null);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadActiveCycle();

        return function () {
            cancelled = true;
        };
    }, []);

    return {
        activeCycle: activeCycle,
        currentPhase: activeCycle?.currentPhase || '',
        loading: loading,
    };
}
