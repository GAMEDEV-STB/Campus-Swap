import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  uid,
  loadStorage,
  saveStorage,
  overlap,
  passesFilter,
  HOLD_DURATION,
  isHeld
} from '../utils/helpers';
import { DONE_LABEL } from '../constants';
import { supabase, supabaseConfigError } from '../lib/supabase';

const AppContext = createContext(null);

const toListing = (row, profiles) => {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  return {
    id: row.id,
    owner: profileById.get(row.owner_id)?.email || '',
    type: row.type,
    title: row.title,
    desc: row.description,
    category: row.category,
    price: row.price,
    want: row.want,
    cond: row.condition,
    place: row.place,
    course: row.course,
    bundle: row.bundle,
    photos: row.photos || [],
    status: row.status,
    partner: profileById.get(row.partner_id)?.email || '',
    reservedFor: profileById.get(row.reserved_for)?.email || '',
    reservedUntil: row.reserved_until ? new Date(row.reserved_until).getTime() : 0,
    swapWith: row.swap_with,
    claims: [],
    t: new Date(row.created_at).getTime()
  };
};

const toRating = (row, profiles) => {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  return {
    id: row.id,
    listingId: row.listing_id,
    from: profileById.get(row.reviewer_id)?.email || '',
    to: profileById.get(row.reviewee_id)?.email || '',
    stars: row.stars,
    text: row.text,
    t: new Date(row.created_at).getTime()
  };
};

const toMessage = (row, profiles) => {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const deletedFor = (row.deleted_for || [])
    .map((id) => profileById.get(id)?.email)
    .filter(Boolean);
  return {
    ...row.payload,
    id: row.id,
    from: profileById.get(row.sender_id)?.email || '',
    t: new Date(row.created_at).getTime(),
    text: row.deleted_for_everyone ? '' : row.text,
    deleted: row.deleted_for_everyone,
    delFor: deletedFor
  };
};

export function AppProvider({ children }) {
  const [toastMsg, setToastMsg] = useState('');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [appError, setAppError] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [listings, setListings] = useState([]);
  const [convos, setConvosState] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [saved, setSaved] = useState(() => loadStorage('cs_saved', []));
  const [searches, setSearches] = useState(() => loadStorage('cs_searches', []));
  const [notifs, setNotifs] = useState(() => loadStorage('cs_notifs', []));
  const [typing, setTyping] = useState(() => loadStorage('cs_typing', {}));
  const convosRef = useRef([]);
  const profileRef = useRef([]);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? '' : prev));
    }, 2400);
  }, []);

  const setConvos = useCallback((next) => {
    convosRef.current = next;
    setConvosState(next);
  }, []);

  const refreshData = useCallback(async (authUser) => {
    if (!supabase) {
      return;
    }
    if (!authUser?.emailVerified) {
      setProfiles([]);
      profileRef.current = [];
      setListings([]);
      setConvos([]);
      setRatings([]);
      setBlocks([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setAppError('');
    try {
      const [profileResult, listingResult, ratingResult, blockResult, claimResult] = await Promise.all([
        supabase.from('profiles').select('id,email,full_name,role'),
        supabase.from('listings').select('*').order('created_at', { ascending: true }),
        supabase.from('ratings').select('*').order('created_at', { ascending: true }),
        supabase.from('blocks').select('*'),
        supabase.from('donation_claims').select('*')
      ]);
      const initialError =
        profileResult.error || listingResult.error || ratingResult.error || blockResult.error || claimResult.error;
      if (initialError) throw initialError;

      const profileRows = profileResult.data || [];
      const profileById = new Map(profileRows.map((profile) => [profile.id, profile]));
      const claimsByListing = new Map();
      for (const claim of claimResult.data || []) {
        const claimant = profileById.get(claim.claimant_id);
        if (!claimant) continue;
        const claims = claimsByListing.get(claim.listing_id) || [];
        claims.push({
          u: claimant.email,
          t: new Date(claim.created_at).getTime(),
          picked: claim.picked
        });
        claimsByListing.set(claim.listing_id, claims);
      }
      profileRef.current = profileRows;
      setProfiles(
        profileRows.map((profile) => ({
          id: profile.id,
          email: profile.email,
          name: profile.full_name,
          role: profile.role
        }))
      );
      const currentProfile = profileById.get(authUser.id);
      if (currentProfile) {
        setUser((current) =>
          current?.id === authUser.id
            ? { ...current, name: currentProfile.full_name || current.name }
            : current
        );
      }
      setListings(
        (listingResult.data || []).map((row) => ({
          ...toListing(row, profileRows),
          claims: claimsByListing.get(row.id) || []
        }))
      );
      setRatings((ratingResult.data || []).map((row) => toRating(row, profileRows)));
      setBlocks(
        (blockResult.data || []).map((row) => ({
          by: profileById.get(row.blocker_id)?.email || '',
          to: profileById.get(row.blocked_id)?.email || '',
          t: new Date(row.created_at).getTime()
        }))
      );

      const convoResult = await supabase
        .from('conversations')
        .select('*')
        .or(`participant1_id.eq.${authUser.id},participant2_id.eq.${authUser.id}`);
      if (convoResult.error) throw convoResult.error;

      const conversationRows = convoResult.data || [];
      let messageRows = [];
      if (conversationRows.length) {
        const messageResult = await supabase
          .from('messages')
          .select('*')
          .in(
            'conversation_id',
            conversationRows.map((row) => row.id)
          )
          .order('created_at', { ascending: true });
        if (messageResult.error) throw messageResult.error;
        messageRows = messageResult.data || [];
      }

      const nextConvos = conversationRows.map((row) => {
        const first = profileById.get(row.participant1_id);
        const second = profileById.get(row.participant2_id);
        const firstReadAt = row.participant1_read_at
          ? new Date(row.participant1_read_at).getTime()
          : 0;
        const secondReadAt = row.participant2_read_at
          ? new Date(row.participant2_read_at).getTime()
          : 0;
        const convoMessages = messageRows
          .filter((message) => message.conversation_id === row.id)
          .map((message) => toMessage(message, profileRows));
        const unread = {};
        for (const [participant, readAt] of [
          [first, firstReadAt],
          [second, secondReadAt]
        ]) {
          if (!participant) continue;
          unread[participant.email] = convoMessages.filter(
            (message) => message.from !== participant.email && message.t > readAt
          ).length;
        }
        return {
          id: row.id,
          listingId: row.listing_id,
          title: '',
          buyer: first?.email || '',
          seller: second?.email || '',
          messages: convoMessages,
          unread,
          hidden: {
            [first?.email]: Boolean(row.participant1_hidden_at),
            [second?.email]: Boolean(row.participant2_hidden_at)
          },
          cleared: {
            [first?.email]: row.participant1_cleared_at
              ? new Date(row.participant1_cleared_at).getTime()
              : 0,
            [second?.email]: row.participant2_cleared_at
              ? new Date(row.participant2_cleared_at).getTime()
              : 0
          },
          readAt: {
            [first?.email]: firstReadAt,
            [second?.email]: secondReadAt
          }
        };
      });
      for (const convo of nextConvos) {
        const listing = (listingResult.data || []).find((row) => row.id === convo.listingId);
        if (listing) {
          convo.title = `${listing.type === 'request' ? 'Wanted: ' : ''}${listing.title}`;
        }
      }
      convosRef.current = nextConvos;
      setConvosState(nextConvos);
      setDataLoading(false);
    } catch (error) {
      setDataLoading(false);
      setAppError(`Couldn't load Campus Swap data: ${error.message}`);
    }
  }, [setConvos]);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return undefined;
    }
    let active = true;
    const applySession = (session) => {
      if (!active) return;
      const authUser = session?.user;
      if (!authUser) {
        setUser(null);
        setAuthLoading(false);
        return;
      }
      setUser({
        id: authUser.id,
        email: authUser.email || '',
        name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Student',
        emailVerified: Boolean(authUser.email_confirmed_at)
      });
      setAuthLoading(false);
    };

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          setAppError(`Couldn't restore your session: ${error.message}`);
          setAuthLoading(false);
          return;
        }
        applySession(data.session);
      })
      .catch((error) => {
        setAppError(`Couldn't restore your session: ${error.message}`);
        setAuthLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthModal({ open: true, mode: 'reset', afterLogin: null });
      }
      applySession(session);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authLoading) refreshData(user);
  }, [authLoading, user?.id, user?.emailVerified, refreshData]);

  const authModalInit = { open: false, mode: 'login', afterLogin: null };
  const [authModal, setAuthModal] = useState(authModalInit);
  const [postModal, setPostModal] = useState({ open: false, type: 'sell', title: '', editItem: null });
  const [detailModal, setDetailModal] = useState({ open: false, listingId: null });
  const [profileModal, setProfileModal] = useState({ open: false, email: null });
  const [rateModal, setRateModal] = useState({ open: false, listing: null });
  const [doneModal, setDoneModal] = useState({ open: false, listing: null });
  const [holdModal, setHoldModal] = useState({ open: false, listing: null });
  const [offerModal, setOfferModal] = useState({ open: false });
  const [swapModal, setSwapModal] = useState({ open: false });
  const [reportModal, setReportModal] = useState({ open: false, type: '', target: '', label: '' });
  const [adminModal, setAdminModal] = useState({ open: false });
  const [alertsModal, setAlertsModal] = useState({ open: false });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState(null);

  const requireLogin = useCallback(
    (callback) => {
      if (!user) {
        setAuthModal({ open: true, mode: 'login', afterLogin: callback });
      } else if (!user.emailVerified) {
        toast('Verify your email before using this feature.');
      } else {
        try {
          const result = callback();
          if (result && typeof result.then === 'function') {
            result.catch((error) => toast(`Action failed: ${error.message}`));
          }
        } catch (error) {
          toast(`Action failed: ${error.message}`);
        }
      }
    },
    [user, toast]
  );

  const signUp = useCallback(async (email, password, fullName) => {
    if (!supabase) throw new Error(supabaseConfigError);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: fullName.trim() || 'Student' },
        emailRedirectTo: window.location.origin
      }
    });
    if (error) throw error;
    return data;
  }, []);

  const signIn = useCallback(async (email, password) => {
    if (!supabase) throw new Error(supabaseConfigError);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
    if (error) throw error;
    if (!data.user?.email_confirmed_at) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      throw new Error('Verify your email address before signing in.');
    }
    setAuthModal(authModalInit);
    return data;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error(supabaseConfigError);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
  }, []);

  const sendPasswordReset = useCallback(async (email) => {
    if (!supabase) throw new Error(supabaseConfigError);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/`
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password) => {
    if (!supabase) throw new Error(supabaseConfigError);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setAuthModal(authModalInit);
  }, []);

  const resendVerification = useCallback(async (email) => {
    if (!supabase) throw new Error(supabaseConfigError);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase()
    });
    if (error) throw error;
  }, []);

  const logoutUser = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast(`Couldn't log out: ${error.message}`);
      return;
    }
    setIsChatOpen(false);
    setActiveChatId(null);
    toast('Logged out');
  }, [toast]);

  const nameOf = useCallback(
    (email) => profiles.find((profile) => profile.email === email)?.name || 'Student',
    [profiles]
  );

  const notify = useCallback(
    (toEmail, text, listingId) => {
      if (!toEmail || (user && toEmail === user.email)) return;
      const next = [
        ...loadStorage('cs_notifs', []),
        { id: uid(), to: toEmail, text, listingId, t: Date.now(), read: false }
      ];
      saveStorage('cs_notifs', next);
      setNotifs(next);
    },
    [user]
  );

  const runMatching = useCallback(
    (item) => {
      const others = listings.filter(
        (listing) =>
          listing.owner !== item.owner &&
          listing.status !== 'done' &&
          !blocks.some(
            (block) =>
              (block.by === listing.owner && block.to === item.owner) ||
              (block.by === item.owner && block.to === listing.owner)
          )
      );
      if (item.type === 'request') {
        others
          .filter((listing) => listing.type !== 'request' && overlap(item, listing))
          .forEach((listing) =>
            notify(listing.owner, `Someone is looking for “${item.title}”. You listed “${listing.title}”.`, item.id)
          );
      } else {
        others
          .filter((listing) => listing.type === 'request' && overlap(listing, item))
          .forEach((listing) =>
            notify(listing.owner, `“${item.title}” was just posted and matches your request “${listing.title}”.`, item.id)
          );
      }
      searches
        .filter((search) => search.owner !== item.owner && passesFilter(item, search))
        .forEach((search) => notify(search.owner, `New listing for your saved search (${search.label}): ${item.title}.`, item.id));
    },
    [listings, blocks, searches, notify]
  );

  const saveListingItem = useCallback(
    async (data, editId = null) => {
      if (!supabase || !user?.emailVerified) {
        toast('Verify your email before posting.');
        return false;
      }
      const row = {
        type: data.type,
        title: data.title,
        description: data.desc || '',
        category: data.category,
        price: data.price === '' ? null : Number(data.price),
        want: data.want || '',
        condition: data.cond || 'good',
        place: data.place || '',
        course: data.course || '',
        bundle: Boolean(data.bundle),
        photos: data.photos || (data.photo ? [data.photo] : [])
      };
      const query = editId
        ? supabase.from('listings').update(row).eq('id', editId).eq('owner_id', user.id)
        : supabase.from('listings').insert({ ...row, owner_id: user.id });
      const { data: savedRows, error } = await query.select('*');
      if (error) {
        toast(`Couldn't save listing: ${error.message}`);
        return false;
      }
      if (!savedRows?.length) {
        toast('You can only edit your own listings.');
        return false;
      }
      const currentProfiles = [
        ...profileRef.current.filter((profile) => profile.id !== user.id),
        { id: user.id, email: user.email }
      ];
      const savedListing = toListing(savedRows[0], currentProfiles);
      setListings((current) =>
        editId
          ? current.map((listing) => (listing.id === editId ? savedListing : listing))
          : [...current, savedListing]
      );
      if (!editId) runMatching(savedListing);
      setPostModal({ open: false, type: 'sell', title: '', editItem: null });
      toast(editId ? 'Listing updated' : savedListing.type === 'request' ? 'Request posted' : 'Listing published');
      return true;
    },
    [user, toast, runMatching]
  );

  const deleteListing = useCallback(
    async (listing) => {
      if (!window.confirm(`Delete "${listing.title}" from Campus Swap? This can't be undone.`)) return;
      const { data, error } = await supabase
        .from('listings')
        .delete()
        .eq('id', listing.id)
        .select('id');
      if (error) {
        toast(`Couldn't delete listing: ${error.message}`);
        return;
      }
      if (!data?.length) {
        toast('You can only delete your own listings.');
        return;
      }
      setListings((current) => current.filter((item) => item.id !== listing.id));
      if (detailModal.open && detailModal.listingId === listing.id) {
        setDetailModal({ open: false, listingId: null });
      }
      toast('Listing deleted');
    },
    [detailModal, toast]
  );

  const finishDone = useCallback(
    async (listing, partnerEmail) => {
      const partnerId = profileRef.current.find((profile) => profile.email === partnerEmail)?.id || null;
      const { data, error } = await supabase
        .from('listings')
        .update({ status: 'done', partner_id: partnerId, reserved_for: null, reserved_until: null })
        .eq('id', listing.id)
        .eq('owner_id', user.id)
        .select('id');
      if (error) {
        toast(`Couldn't complete exchange: ${error.message}`);
        return false;
      }
      if (!data?.length) {
        toast('Only the listing owner can mark this exchange complete.');
        return false;
      }
      if (listing.swapWith) {
        const { data: swapData, error: swapError } = await supabase
          .from('listings')
          .update({ status: 'done', partner_id: listing.owner === user.email ? partnerId : user.id })
          .eq('id', listing.swapWith)
          .eq('owner_id', user.id)
          .select('id');
        if (swapError) toast(`Couldn't complete the paired listing: ${swapError.message}`);
        else if (!swapData?.length) toast('The other listing must be completed by its owner.');
      }
      await refreshData(user);
      toast(DONE_LABEL[listing.type] + '. You can remove it from your listings now.');
      return true;
    },
    [user, toast, refreshData]
  );

  const holdFor = useCallback(
    async (listing, whoEmail) => {
      const reservedFor = profileRef.current.find((profile) => profile.email === whoEmail)?.id;
      if (!reservedFor) {
        toast("Couldn't reserve for that student.");
        return;
      }
      const { data, error } = await supabase
        .from('listings')
        .update({ reserved_for: reservedFor, reserved_until: new Date(Date.now() + HOLD_DURATION).toISOString() })
        .eq('id', listing.id)
        .eq('owner_id', user.id)
        .select('id');
      if (error) {
        toast(`Couldn't reserve listing: ${error.message}`);
        return;
      }
      if (!data?.length) {
        toast('Only the listing owner can reserve this item.');
        return;
      }
      await refreshData(user);
      notify(whoEmail, `“${listing.title}” is held for you for 24 hours.`, listing.id);
      toast('Held for ' + nameOf(whoEmail) + ' for 24 hours');
    },
    [user, toast, refreshData, notify, nameOf]
  );

  const clearHold = useCallback(
    async (listing) => {
      const { data, error } = await supabase
        .from('listings')
        .update({ reserved_for: null, reserved_until: null })
        .eq('id', listing.id)
        .eq('owner_id', user.id)
        .select('id');
      if (error) {
        toast(`Couldn't release hold: ${error.message}`);
        return;
      }
      if (!data?.length) {
        toast('Only the listing owner can release this hold.');
        return;
      }
      await refreshData(user);
      toast('Hold released');
    },
    [user, toast, refreshData]
  );

  const openChatForRef = useRef(null);

  const claimDonate = useCallback(
    (listing) => {
      requireLogin(async () => {
        const claims = listing.claims || [];
        if (claims.some((claim) => claim.u === user.email)) {
          toast("You're already in the queue");
          openChatForRef.current?.(listing);
          return;
        }
        const { error } = await supabase.from('donation_claims').insert({
          listing_id: listing.id,
          claimant_id: user.id
        });
        if (error) {
          toast(`Couldn't join the donation queue: ${error.message}`);
          return;
        }
        await refreshData(user);
        notify(listing.owner, nameOf(user.email) + ' claimed “' + listing.title + '”. Pick someone from the donation queue.', listing.id);
        toast("You're in the donation queue");
        openChatForRef.current?.(listing);
      });
    },
    [user, requireLogin, toast, refreshData, notify, nameOf]
  );

  const pickClaim = useCallback(
    async (listing, chosenEmail) => {
      const chosenId = profileRef.current.find((profile) => profile.email === chosenEmail)?.id;
      if (!chosenId) {
        toast("Couldn't find that student's profile.");
        return;
      }
      const { error: clearError } = await supabase
        .from('donation_claims')
        .update({ picked: false })
        .eq('listing_id', listing.id);
      if (clearError) {
        toast(`Couldn't update donation queue: ${clearError.message}`);
        return;
      }
      const { error: pickError } = await supabase
        .from('donation_claims')
        .update({ picked: true })
        .eq('listing_id', listing.id)
        .eq('claimant_id', chosenId);
      if (pickError) {
        toast(`Couldn't select a claimant: ${pickError.message}`);
        return;
      }
      const { data, error } = await supabase
        .from('listings')
        .update({
          reserved_for: chosenId,
          reserved_until: new Date(Date.now() + HOLD_DURATION).toISOString()
        })
        .eq('id', listing.id)
        .eq('owner_id', user.id)
        .select('id');
      if (error) {
        toast(`Couldn't select a claimant: ${error.message}`);
        return;
      }
      if (!data?.length) {
        toast('Only the listing owner can select a claimant.');
        return;
      }
      await refreshData(user);
      notify(chosenEmail, `“${listing.title}” is held for you for 24 hours.`, listing.id);
      (listing.claims || []).forEach((claim) => {
        if (claim.u !== chosenEmail) notify(claim.u, `The donor picked someone else for “${listing.title}”.`, listing.id);
      });
      toast('Picked ' + nameOf(chosenEmail) + '. Item is held for 24 hours.');
    },
    [user, toast, refreshData, notify, nameOf]
  );

  const toggleSave = useCallback(
    (listingId) => {
      requireLogin(() => {
        const has = saved.some((item) => item.u === user.email && item.id === listingId);
        const next = has
          ? saved.filter((item) => !(item.u === user.email && item.id === listingId))
          : [...saved, { u: user.email, id: listingId }];
        setSaved(next);
        saveStorage('cs_saved', next);
        toast(has ? 'Removed from saved' : 'Saved to your wishlist');
      });
    },
    [saved, user, requireLogin, toast]
  );

  const toggleBlock = useCallback(
    async (otherEmail) => {
      requireLogin(async () => {
        const other = profileRef.current.find((profile) => profile.email === otherEmail);
        if (!other) {
          toast("Couldn't find that student's profile.");
          return;
        }
        const existing = blocks.find((block) => block.by === user.email && block.to === otherEmail);
        const result = existing
          ? await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', other.id)
          : await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: other.id });
        if (result.error) {
          toast(`Couldn't update block: ${result.error.message}`);
          return;
        }
        setBlocks((current) =>
          existing
            ? current.filter((block) => !(block.by === user.email && block.to === otherEmail))
            : [...current, { by: user.email, to: otherEmail, t: Date.now() }]
        );
        toast(existing ? 'Unblocked ' + nameOf(otherEmail) : 'Blocked ' + nameOf(otherEmail));
      });
    },
    [blocks, user, requireLogin, toast, nameOf]
  );

  const persistConversations = useCallback(
    async (nextConvos) => {
      const previousConvos = convosRef.current;
      convosRef.current = nextConvos;
      setConvosState(nextConvos);
      if (!supabase || !user?.emailVerified) return;
      const profileByEmail = new Map(profileRef.current.map((profile) => [profile.email, profile]));
      for (const convo of nextConvos) {
        const firstId = profileByEmail.get(convo.buyer)?.id;
        const secondId = profileByEmail.get(convo.seller)?.id;
        if (!firstId || !secondId) continue;
        const previous = previousConvos.find((item) => item.id === convo.id);
        const ownParticipant = convo.buyer === user.email ? 1 : 2;
        const metadata = {};
        if (convo.hidden && Object.hasOwn(convo.hidden, user.email)) {
          metadata[`participant${ownParticipant}_hidden_at`] = convo.hidden[user.email]
            ? new Date().toISOString()
            : null;
        }
        if (convo.readAt && Object.hasOwn(convo.readAt, user.email)) {
          metadata[`participant${ownParticipant}_read_at`] = convo.readAt[user.email]
            ? new Date(convo.readAt[user.email]).toISOString()
            : null;
        }
        if (convo.cleared && Object.hasOwn(convo.cleared, user.email)) {
          metadata[`participant${ownParticipant}_cleared_at`] = convo.cleared[user.email]
            ? new Date(convo.cleared[user.email]).toISOString()
            : null;
        }
        if (Object.keys(metadata).length) {
          const { error } = await supabase.from('conversations').update(metadata).eq('id', convo.id);
          if (error) toast(`Couldn't update conversation: ${error.message}`);
        }

        for (const message of convo.messages) {
          const oldMessage = previous?.messages.find((item) => item.id === message.id);
          const sender = profileByEmail.get(message.from);
          if (!sender) continue;
          const { id, from, t, text, deleted, delFor, ...payload } = message;
          const fields = {
            text: deleted ? '' : text || '',
            payload,
            deleted_for: (delFor || [])
              .map((email) => profileByEmail.get(email)?.id)
              .filter(Boolean),
            deleted_for_everyone: Boolean(deleted)
          };
          if (!oldMessage) {
            const { error } = await supabase.from('messages').insert({
              id,
              conversation_id: convo.id,
              sender_id: sender.id,
              ...fields
            });
            if (error) toast(`Couldn't send message: ${error.message}`);
          } else if (JSON.stringify(oldMessage) !== JSON.stringify(message)) {
            const { error } = await supabase.from('messages').update(fields).eq('id', id);
            if (error) toast(`Couldn't update message: ${error.message}`);
          }
        }
      }
    },
    [user, toast]
  );

  const openChatFor = useCallback(
    async (listing) => {
      requireLogin(async () => {
        const currentListing = listings.find((item) => item.id === listing.id);
        if (!currentListing || currentListing.status === 'done') {
          toast('This item is no longer available');
          return;
        }
        if (blocks.some((block) => (block.by === user.email && block.to === currentListing.owner) || (block.by === currentListing.owner && block.to === user.email))) {
          toast("You can't message this student");
          return;
        }
        if (isHeld(currentListing) && currentListing.reservedFor !== user.email && currentListing.owner !== user.email) {
          toast('This item is held for another student');
          return;
        }
        const owner = profileRef.current.find((profile) => profile.email === currentListing.owner);
        if (!owner || owner.id === user.id) {
          toast("You can't start a conversation with yourself.");
          return;
        }
        let conversation = convosRef.current.find(
          (item) =>
            item.listingId === currentListing.id &&
            [item.buyer, item.seller].includes(user.email) &&
            [item.buyer, item.seller].includes(owner.email)
        );
        if (!conversation) {
          const { data, error } = await supabase
            .from('conversations')
            .insert({
              listing_id: currentListing.id,
              participant1_id: user.id,
              participant2_id: owner.id
            })
            .select('*')
            .single();
          if (error && error.code !== '23505') {
            toast(`Couldn't start conversation: ${error.message}`);
            return;
          }
          if (data) {
            conversation = {
              id: data.id,
              listingId: currentListing.id,
              title: `${currentListing.type === 'request' ? 'Wanted: ' : ''}${currentListing.title}`,
              buyer: user.email,
              seller: owner.email,
              messages: [],
              unread: {},
              hidden: {},
              cleared: {},
              readAt: {}
            };
          } else {
            const { data: existing, error: existingError } = await supabase
              .from('conversations')
              .select('*')
              .eq('listing_id', currentListing.id)
              .or(
                `and(participant1_id.eq.${user.id},participant2_id.eq.${owner.id}),and(participant1_id.eq.${owner.id},participant2_id.eq.${user.id})`
              )
              .maybeSingle();
            if (existingError) {
              toast(`Couldn't open conversation: ${existingError.message}`);
              return;
            }
            if (!existing) {
              toast("Couldn't find the existing conversation.");
              return;
            }
            conversation = {
              id: existing.id,
              listingId: currentListing.id,
              title: `${currentListing.type === 'request' ? 'Wanted: ' : ''}${currentListing.title}`,
              buyer: profileRef.current.find((profile) => profile.id === existing.participant1_id)?.email || '',
              seller: profileRef.current.find((profile) => profile.id === existing.participant2_id)?.email || '',
              messages: [],
              unread: {},
              hidden: {},
              cleared: {},
              readAt: {}
            };
          }
        }
        const visibleConversation = {
          ...conversation,
          hidden: { ...(conversation.hidden || {}), [user.email]: false }
        };
        const currentConvos = convosRef.current;
        setConvos([...currentConvos.filter((item) => item.id !== visibleConversation.id), visibleConversation]);
        if (conversation.hidden?.[user.email]) {
          const { error: unhideError } = await supabase
            .from('conversations')
            .update({
              [conversation.buyer === user.email ? 'participant1_hidden_at' : 'participant2_hidden_at']: null
            })
            .eq('id', conversation.id);
          if (unhideError) toast(`Couldn't restore conversation: ${unhideError.message}`);
        }
        setActiveChatId(conversation.id);
        setIsChatOpen(true);
      });
    },
    [listings, blocks, user, requireLogin, toast, setConvos]
  );
  openChatForRef.current = openChatFor;

  const submitRating = useCallback(
    async (listingId, revieweeEmail, stars, text) => {
      const reviewee = profileRef.current.find((profile) => profile.email === revieweeEmail);
      if (!reviewee || !user) {
        toast("Couldn't find the exchange participant.");
        return false;
      }
      const { error } = await supabase.from('ratings').insert({
        listing_id: listingId,
        reviewer_id: user.id,
        reviewee_id: reviewee.id,
        stars: Number(stars),
        text: text.trim()
      });
      if (error) {
        toast(`Couldn't submit rating: ${error.message}`);
        return false;
      }
      await refreshData(user);
      toast('Rating submitted');
      return true;
    },
    [user, toast, refreshData]
  );

  const value = useMemo(
    () => ({
      user,
      users: profiles,
      logoutUser,
      authLoading,
      dataLoading,
      appError,
      refreshData: () => refreshData(user),
      nameOf,
      listings,
      setListings,
      saveListingItem,
      deleteListing,
      finishDone,
      holdFor,
      clearHold,
      claimDonate,
      pickClaim,
      convos,
      setConvos: persistConversations,
      ratings,
      blocks,
      setBlocks,
      saved,
      setSaved,
      toggleSave,
      toggleBlock,
      searches,
      setSearches,
      notifs,
      setNotifs,
      typing,
      setTyping,
      toast,
      toastMsg,
      requireLogin,
      signUp,
      signIn,
      signInWithGoogle,
      sendPasswordReset,
      updatePassword,
      resendVerification,
      notify,
      runMatching,
      submitRating,
      openChatFor,
      isChatOpen,
      setIsChatOpen,
      activeChatId,
      setActiveChatId,
      authModal,
      setAuthModal,
      postModal,
      setPostModal,
      detailModal,
      setDetailModal,
      profileModal,
      setProfileModal,
      rateModal,
      setRateModal,
      doneModal,
      setDoneModal,
      holdModal,
      setHoldModal,
      offerModal,
      setOfferModal,
      swapModal,
      setSwapModal,
      reportModal,
      setReportModal,
      adminModal,
      setAdminModal,
      alertsModal,
      setAlertsModal
    }),
    [
      user,
      profiles,
      logoutUser,
      authLoading,
      dataLoading,
      appError,
      refreshData,
      nameOf,
      listings,
      saveListingItem,
      deleteListing,
      finishDone,
      holdFor,
      clearHold,
      claimDonate,
      pickClaim,
      convos,
      persistConversations,
      ratings,
      blocks,
      saved,
      toggleSave,
      toggleBlock,
      searches,
      notifs,
      typing,
      toast,
      toastMsg,
      requireLogin,
      signUp,
      signIn,
      signInWithGoogle,
      sendPasswordReset,
      updatePassword,
      resendVerification,
      notify,
      runMatching,
      submitRating,
      openChatFor,
      isChatOpen,
      activeChatId,
      authModal,
      postModal,
      detailModal,
      profileModal,
      rateModal,
      doneModal,
      holdModal,
      offerModal,
      swapModal,
      reportModal,
      adminModal,
      alertsModal
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
