import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import ListingCard from './ListingCard';
import { CATEGORIES, CONDS, PLACES } from '../constants';
import { passesFilter, describeFilter, uid, saveStorage } from '../utils/helpers';

export default function BrowseSection({ searchQuery, setSearchQuery, isSavedOnly, setIsSavedOnly }) {
  const {
    listings,
    user,
    blocks,
    saved,
    searches,
    setSearches,
    requireLogin,
    setPostModal,
    toast
  } = useApp();

  const [category, setCategory] = useState('All');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('new');

  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [condition, setCondition] = useState('all');
  const [location, setLocation] = useState('all');
  const [courseCode, setCourseCode] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);

  const savedSet = useMemo(() => {
    if (!user) return new Set();
    return new Set(saved.filter((x) => x.u === user.email).map((x) => x.id));
  }, [saved, user]);

  const currentFilterObj = useMemo(
    () => ({
      q: searchQuery,
      cat: category,
      type: typeFilter,
      min: minPrice,
      max: maxPrice,
      cond: condition,
      place: location,
      free: freeOnly,
      course: courseCode
    }),
    [searchQuery, category, typeFilter, minPrice, maxPrice, condition, location, freeOnly, courseCode]
  );

  const filteredListings = useMemo(() => {
    let items = listings.filter((l) => {
      // Exclude blocked interactions
      if (user && l.owner !== user.email) {
        const isBlocked = blocks.some(
          (b) =>
            (b.by === user.email && b.to === l.owner) ||
            (b.by === l.owner && b.to === user.email)
        );
        if (isBlocked) return false;
      }
      if (!passesFilter(l, currentFilterObj)) return false;
      if (isSavedOnly && !savedSet.has(l.id)) return false;
      return true;
    });

    if (sortFilter === 'low') {
      items = [...items].sort((a, b) => (a.price || 0) - (b.price || 0));
    } else {
      items = [...items].reverse();
    }
    return items;
  }, [listings, user, blocks, currentFilterObj, isSavedOnly, savedSet, sortFilter]);

  const handleClearFilters = () => {
    setCategory('All');
    setTypeFilter('all');
    setSortFilter('new');
    setMinPrice('');
    setMaxPrice('');
    setCondition('all');
    setLocation('all');
    setCourseCode('');
    setFreeOnly(false);
    setIsSavedOnly(false);
    setSearchQuery('');
  };

  const handleSaveSearch = () => {
    requireLogin(() => {
      const label = describeFilter(currentFilterObj);
      if (!label) {
        toast('Set a search or filter first');
        return;
      }
      const newSearch = {
        id: uid(),
        owner: user.email,
        label,
        ...currentFilterObj
      };
      const updated = [...searches, newSearch];
      setSearches(updated);
      saveStorage('cs_searches', updated);
      toast("Search saved. You'll get an alert for new matches.");
    });
  };

  const hasAnyListings = listings.length > 0;
  const noMatches = hasAnyListings && filteredListings.length === 0;

  return (
    <section id="browse" className="browse">
      <div className="section-head">
        <div>
          <h2>Browse listings</h2>
          <p className="desc browse-lead">
            Filter by price, condition, hostel, course code or free items. Save a search to get an alert.
          </p>
        </div>

        <div className="filters">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Listing type"
          >
            <option value="all">All types</option>
            <option value="sell">For sale</option>
            <option value="swap">Swap</option>
            <option value="donate">Free (donated)</option>
            <option value="request">Wanted (requests)</option>
          </select>

          <select
            value={sortFilter}
            onChange={(e) => setSortFilter(e.target.value)}
            aria-label="Sort"
          >
            <option value="new">Newest first</option>
            <option value="low">Price: low to high</option>
          </select>
        </div>
      </div>

      <div className="chips">
        {['All', ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            type="button"
            className="chip"
            aria-pressed={category === cat}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="filters2">
        <label>
          Min ₹
          <input
            type="number"
            min="0"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
        </label>

        <label>
          Max ₹
          <input
            type="number"
            min="0"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </label>

        <label>
          Condition
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
          >
            <option value="all">Any</option>
            {Object.entries(CONDS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label>
          Location
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          >
            <option value="all">Anywhere</option>
            {PLACES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label>
          Course code
          <input
            placeholder="e.g. CS101"
            maxLength={16}
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
          />
        </label>

        <label className="chk">
          <input
            type="checkbox"
            checked={freeOnly}
            onChange={(e) => setFreeOnly(e.target.checked)}
          />
          Free only
        </label>

        {user && (
          <label className="chk">
            <input
              type="checkbox"
              checked={isSavedOnly}
              onChange={(e) => setIsSavedOnly(e.target.checked)}
            />
            Saved only
          </label>
        )}

        <button type="button" className="btn btn-ghost sm" onClick={handleSaveSearch}>
          Save this search
        </button>

        <button type="button" className="link-btn" onClick={handleClearFilters}>
          Clear filters
        </button>
      </div>

      {filteredListings.length > 0 ? (
        <div className="grid">
          {filteredListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              isSaved={savedSet.has(listing.id)}
            />
          ))}
        </div>
      ) : (
        <div className="empty">
          <h3>
            {isSavedOnly
              ? 'Nothing saved yet'
              : noMatches
              ? 'Nothing matches yet'
              : 'No listings yet'}
          </h3>
          <p>
            {isSavedOnly
              ? 'Tap the heart on a listing to save it here.'
              : noMatches
              ? 'Try a different search or filter, save this search for an alert, or post what you want to share or request.'
              : 'Be the first to post. Sell something, offer a swap, donate, or request what you need.'}
          </p>
          <button
            type="button"
            className="btn btn-dark"
            onClick={() => requireLogin(() => setPostModal({ open: true, type: 'sell', title: '' }))}
          >
            Post a listing
          </button>
        </div>
      )}
    </section>
  );
}
