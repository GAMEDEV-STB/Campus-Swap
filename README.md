# Campus Swap (React Version)

A full-featured student marketplace application converted from vanilla JavaScript to modern **React 18** and **Vite**.

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** v20+ (tested on Node v20.10.0)
- **npm** or **pnpm**

### 2. Installation & Run
```bash
# Navigate to the project directory
cd campus-swap-react

# Install dependencies (already installed if using this folder)
npm install

# Start the Vite development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Supabase setup

1. Create a Supabase project and enable email/password sign-up with email confirmation.
2. Apply both migrations in [`supabase/migrations/`](./supabase/migrations/) in timestamp order in the Supabase SQL Editor. The first creates the schema and policies; the second enables Gmail signups for an already provisioned database.
3. Configure the Supabase project URL and anon/public key in a root `.env.local` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Copy `.env.example` as a starting point. Only the Supabase URL and anon key belong
in these frontend variables; never use a service-role key. Configure Supabase
Auth's Site URL and allowed redirect URLs for the local and production app URLs.
The database trigger restricts new registrations to `@bmsce.ac.in` and
`@gmail.com`. Email confirmation must remain enabled.

The first migration seeds the initial admin address supplied for this project.
That email address is promoted to admin by the database seed. No admin
addresses are bundled into the client. Existing browser-local marketplace data
is not imported; the Supabase database starts empty. To add an admin later,
run in the SQL Editor:

```sql
insert into private.admin_email_seeds (email)
values (lower('new-admin@bmsce.ac.in'))
on conflict (email) do nothing;

update public.profiles
set role = 'admin'
where lower(email) = lower('new-admin@bmsce.ac.in');
```

The seed also promotes that address automatically if it registers later. To
remove an admin, first downgrade its profile and then remove its seed row:

```sql
update public.profiles
set role = 'user'
where lower(email) = lower('admin-address');

delete from private.admin_email_seeds
where email = lower('admin-address');
```

Removing the seed changes only the admin role; both allowed email domains remain
available to regular users.

### Authorization verification checklist

With Vite running, submit a disposable report through the app first. Then sign
in as a verified normal user and run these checks in the browser's developer
console. Use an expendable listing owned by a different test account for the
delete checks:

```js
const { supabase } = await import('/src/lib/supabase.js');
const reportRead = await supabase.from('reports').select('id');
// reportRead.data is [] and reportRead.error is null.

const { data: authData } = await supabase.auth.getUser();
const roleChange = await supabase
  .from('profiles')
  .update({ role: 'admin' })
  .eq('id', authData.user.id)
  .select('role');
// roleChange.error is set; authenticated users have no profile UPDATE grant.

const otherListingDelete = await supabase
  .from('listings')
  .delete()
  .eq('id', '<other-user-listing-uuid>')
  .select('id');
// otherListingDelete.data is [].
```

Sign in as the seeded admin and repeat the final delete against a different
expendable listing; `data` must contain the deleted row. RLS, not UI state,
determines these results. Resolve the disposable report in the admin queue after
the test.

Alternatively, the Supabase SQL Editor can test the policies with test account
UUIDs. Start a separate transaction for each identity, impersonate that
verified account by setting its JWT claims, and roll back afterward:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<verified-user-uuid>', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
```

As a normal verified user:

1. Run `insert into public.reports (reporter_id, target_type, target_id, reason)
   values (auth.uid(), 'chat', gen_random_uuid(), 'RLS test');`, then select from
   `public.reports`; the select must return zero rows, including that report.
2. `update public.profiles set role = 'admin' where id = auth.uid();` must fail
   with a permission error.
3. Delete a listing owned by the other test user; the statement must return zero
   rows.

Repeat check 3 with the initial admin UUID; deleting the other user's test
listing must return one row. Roll back each test transaction so the sample data
is not retained. The SQL policies remain the enforcement layer even if a user
modifies the React UI or calls the Supabase API directly.

---

## 📁 Project Structure

```
campus-swap-react/
├── index.html
├── package.json
├── vite.config.js
├── README.md
├── src/
│   ├── main.jsx                     # Application entry point
│   ├── App.jsx                      # Main app shell & modal wiring
│   ├── constants/
│   │   └── index.js                 # Categories, rules, domains, hints, options
│   ├── utils/
│   │   └── helpers.js               # Canvas image compression, matching & filter logic
│   ├── context/
│   │   └── AppContext.jsx           # Supabase auth, profile, and marketplace data
│   ├── hooks/
│   │   └── useIsAdmin.js            # Verified profile role lookup
│   ├── lib/
│   │   └── supabase.js              # Public Supabase client configuration
│   ├── styles/
│   │   └── app.css                  # Unified dark theme styles, animations, dialogs & drawer
│   ├── components/
│       ├── Navbar.jsx               # Header, badges, session state, role-gated navigation
│       ├── Hero.jsx                 # Dynamic mode tabs (Buy, Sell, Swap, Donate, Request) & search
│       ├── BrowseSection.jsx        # Category chips, filters, search, wishlist & cards grid
│       ├── ListingCard.jsx          # Individual listing card with contextual action controls
│       ├── HowItWorks.jsx           # Educational 3-step sequence
│       ├── StaySafe.jsx             # Safety guidelines & campus meeting spots
│       ├── Footer.jsx               # Site footer
│       ├── Toast.jsx                # Non-blocking notification toasts
│       ├── ChatDrawer.jsx           # Supabase message drawer with negotiations & multi-select
│       └── modals/
│           ├── AuthModal.jsx        # Supabase login, signup, email verification, and password reset
│           ├── PostListingModal.jsx # Create & Edit listing with client-side canvas photo compression
│           ├── ListingDetailModal.jsx # Full gallery, facts, donation queue, and seller profile
│           ├── UserProfileModal.jsx # Student reviews, ratings, and active listings
│           ├── RateModal.jsx        # Post-exchange 5-star rating & review submission
│           ├── DoneModal.jsx        # Deal completion & partner attachment
│           ├── HoldModal.jsx        # 24-hour reservation for a specific student
│           ├── ReportModal.jsx      # Safety reporting for listings, users, or chats
│           ├── AdminReportsModal.jsx# Admin review queue for resolving/dismissing reports
│           ├── AlertsModal.jsx      # Notifications & saved search manager
│           ├── OfferModal.jsx       # Counter-offer negotiation in chat
│           └── SwapModal.jsx        # Direct item swap proposal in chat
└── supabase/
    └── migrations/
        └── 20261101000000_campus_swap_security.sql
```

---

## ✨ Features Included

1. **Authentication & Campus Email Verification**:
   - Supabase Auth email/password signup, email verification, login, and password reset.
   - The database trigger allows `@bmsce.ac.in` and `@gmail.com` signups and creates each profile.
   - Email verification is required before marketplace writes.

2. **Listing Management & Photo Uploads**:
   - Modes: **Sell**, **Swap**, **Donate** (free), and **Request** (wanted).
   - Client-side canvas image downscaling (720px max, 0.72 quality JPEG); listings persist in Supabase.
   - Up to 4 photos per listing with cover badge and individual deletion.
   - Move-out bundle tagging & book course codes.
   - Prohibited content detection & live validation.

3. **Real-time Slide-out Chat & Deals**:
   - Direct messaging with unread count badges.
   - Suggested campus public meeting spots (`library entrance`, `main canteen`, etc.).
   - Quick reply chips.
   - Deal cards: **Make an offer** with Accept/Decline; **Propose a swap** with Accept/Decline.
   - Message selection: Copy, Reply (quoted preview that jumps to original), and Delete (for me / for everyone).
   - Supabase-backed conversations/messages, participant-only RLS, and per-participant seen status.

4. **Safety & Ratings**:
   - 24-hour holds on listings for interested buyers.
   - Donation queue: owners can select which student claims a free item.
   - Post-exchange 5-star rating and review system.
   - Student achievement badges (*First swap*, *Regular*, *Campus hero*, *Giver*, *Trusted*).
   - User blocking and reporting system with an Admin Report Queue.

5. **Server-enforced authorization**:
   - Supabase Row Level Security protects listings, conversations, messages, ratings, blocks, and reports.
   - Admin role checks read `profiles.role`; report access and listing removal are independently enforced by RLS.
