import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { CATEGORIES, CONDS, PLACES, RULES } from '../../constants';
import { resizeImage, bannedHit, photosOf } from '../../utils/helpers';

export default function PostListingModal() {
  const { postModal, setPostModal, saveListingItem, toast } = useApp();

  const isEditing = Boolean(postModal.editItem);
  const editItem = postModal.editItem;

  const [type, setType] = useState(postModal.type || 'sell');
  const [title, setTitle] = useState(postModal.title || '');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [want, setWant] = useState('');
  const [desc, setDesc] = useState('');
  const [cond, setCond] = useState('good');
  const [place, setPlace] = useState('');
  const [course, setCourse] = useState('');
  const [bundle, setBundle] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [banWarn, setBanWarn] = useState('');

  useEffect(() => {
    if (editItem) {
      setType(editItem.type || 'sell');
      setTitle(editItem.title || '');
      setCategory(editItem.category || '');
      setPrice(editItem.price || '');
      setWant(editItem.want || '');
      setDesc(editItem.desc || '');
      setCond(editItem.cond || 'good');
      setPlace(editItem.place || '');
      setCourse(editItem.course || '');
      setBundle(Boolean(editItem.bundle));
      setPhotos(photosOf(editItem));
    } else {
      setType(postModal.type || 'sell');
      setTitle(postModal.title || '');
      setCategory('');
      setPrice('');
      setWant('');
      setDesc('');
      setCond('good');
      setPlace('');
      setCourse('');
      setBundle(false);
      setPhotos([]);
    }
    setBanWarn('');
  }, [editItem, postModal.type, postModal.title, postModal.open]);

  if (!postModal.open) return null;

  const handleClose = () => {
    setPostModal({ open: false, type: 'sell', title: '', editItem: null });
  };

  const checkBannedContent = (tVal, dVal, wVal) => {
    const hit = bannedHit([tVal, dVal, wVal].join(' '));
    if (hit) {
      setBanWarn(`This looks like ${hit}, which isn't allowed on Campus Swap. Change the listing to post it.`);
    } else {
      setBanWarn('');
    }
    return hit;
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    const newPhotos = [...photos];
    for (const file of files) {
      if (newPhotos.length >= 4) {
        toast('You can add up to 4 photos');
        break;
      }
      if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
        toast(`Skipped ${file.name}. Choose an image under 10 MB.`);
        continue;
      }
      try {
        const resized = await resizeImage(file);
        newPhotos.push(resized);
      } catch {
        toast(`Couldn't read ${file.name}`);
      }
    }
    setPhotos(newPhotos);
    e.target.value = '';
  };

  const handleRemovePhoto = (idx) => {
    setPhotos(photos.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!title.trim()) {
      toast('Enter a title before publishing');
      return;
    }
    if (!category) {
      toast('Choose a category before publishing');
      return;
    }
    if (!photos.length) {
      toast('Add at least one photo before publishing');
      return;
    }
    if (checkBannedContent(title, desc, want)) {
      toast('This listing breaks the posting rules');
      return;
    }

    const priced = type === 'sell' || type === 'request';
    const listingData = {
      title: title.trim(),
      category,
      type,
      price: priced ? Number(price || 0) : 0,
      photos: [...photos],
      photo: photos[0] || '',
      cond: type === 'request' ? '' : cond,
      place,
      course: course.trim(),
      bundle,
      want: type === 'swap' ? want.trim() : '',
      desc: desc.trim()
    };

    saveListingItem(listingData, isEditing ? editItem.id : null);
  };

  const isPriced = type === 'sell' || type === 'request';

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content wide" onClick={(e) => e.stopPropagation()}>
        <h2>{isEditing ? 'Edit listing' : 'Post to Campus Swap'}</h2>

        <form onSubmit={handleSubmit}>
          <div className="seg" role="radiogroup" aria-label="Listing type">
            {[
              { id: 'sell', label: 'Sell' },
              { id: 'swap', label: 'Swap' },
              { id: 'donate', label: 'Donate' },
              { id: 'request', label: 'Request' }
            ].map((t) => (
              <label key={t.id}>
                <input
                  type="radio"
                  name="type"
                  value={t.id}
                  checked={type === t.id}
                  onChange={() => setType(t.id)}
                />
                <span>{t.label}</span>
              </label>
            ))}
          </div>

          <label>
            Title (required)
            <input
              type="text"
              required
              maxLength={60}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                checkBannedContent(e.target.value, desc, want);
              }}
            />
          </label>

          <label>
            Category (required)
            <select
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Choose a category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          {category === 'Books' && (
            <label>
              Course code (for textbooks)
              <input
                type="text"
                maxLength={16}
                placeholder="e.g. CS101"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              />
            </label>
          )}

          {type !== 'request' && (
            <label>
              Condition
              <select value={cond} onChange={(e) => setCond(e.target.value)}>
                {Object.entries(CONDS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Location
            <select value={place} onChange={(e) => setPlace(e.target.value)}>
              <option value="">Not specified</option>
              {PLACES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="chk post-chk">
            <input
              type="checkbox"
              checked={bundle}
              onChange={(e) => setBundle(e.target.checked)}
            />
            This is a move-out / bundle listing (e.g. dorm starter kit)
          </label>

          {isPriced && (
            <label>
              <span>{type === 'request' ? 'Budget (₹, required)' : 'Price (₹, required)'}</span>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
          )}

          {type === 'swap' && (
            <label>
              What would you swap for?
              <input
                type="text"
                maxLength={80}
                value={want}
                onChange={(e) => {
                  setWant(e.target.value);
                  checkBannedContent(title, desc, e.target.value);
                }}
              />
            </label>
          )}

          <div className="photos">
            <label>
              Photos (required; up to 4, first is cover)
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
              />
            </label>
            {photos.length > 0 && (
              <div className="thumbs">
                {photos.map((p, i) => (
                  <div key={i} className="thumb">
                    <img src={p} alt={`Photo ${i + 1}`} />
                    {i === 0 && <span className="cover-tag">Cover</span>}
                    <button
                      type="button"
                      aria-label={`Remove photo ${i + 1}`}
                      onClick={() => handleRemovePhoto(i)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label>
            Description
            <textarea
              rows={3}
              maxLength={240}
              value={desc}
              onChange={(e) => {
                setDesc(e.target.value);
                checkBannedContent(title, e.target.value, want);
              }}
            />
          </label>

          <p className="note policy">
            Not allowed: {RULES.map((r) => r.toLowerCase()).join('; ')}. Listings that break these rules are removed.
          </p>

          {banWarn && (
            <p className="err" role="alert">
              {banWarn}
            </p>
          )}

          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-dark">
              {isEditing ? 'Save changes' : 'Publish listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
