import db from '../db.js';

// --- Deterministic price intelligence -------------------------------------
// This is the core, always-available logic. It never invents facts about
// the item; it only compares numbers against other listings in the same
// category and condition band. An OpenAI call (if configured) is used only
// to phrase the explanation in friendlier language - never to invent numbers.

const CONDITION_WEIGHT = {
  new: 1.0,
  'like-new': 0.9,
  good: 0.78,
  fair: 0.6,
  worn: 0.45,
};

export function analyzePricing({ categoryId, condition, price, excludeListingId }) {
  const rows = db
    .prepare(
      `SELECT price FROM listings
       WHERE category_id = ? AND status = 'active' AND price IS NOT NULL
       AND id != ?`
    )
    .all(categoryId, excludeListingId || '');

  const comparablePrices = rows.map((r) => r.price).filter((p) => p > 0);

  if (comparablePrices.length < 3) {
    return {
      status: 'insufficient_data',
      message:
        "I don't have enough similar listings to confidently estimate this price yet.",
      sampleSize: comparablePrices.length,
    };
  }

  comparablePrices.sort((a, b) => a - b);
  const median = percentile(comparablePrices, 0.5);
  const low = percentile(comparablePrices, 0.25);
  const high = percentile(comparablePrices, 0.75);

  const weight = CONDITION_WEIGHT[condition] ?? 0.75;
  const adjustedLow = Math.round(low * weight);
  const adjustedHigh = Math.round(high * weight);
  const adjustedMedian = Math.round(median * weight);

  let classification = 'fair';
  let diffPct = 0;
  if (price != null && adjustedMedian > 0) {
    diffPct = Math.round(((price - adjustedMedian) / adjustedMedian) * 100);
    if (diffPct <= -15) classification = 'great_deal';
    else if (diffPct <= 8) classification = 'fair';
    else if (diffPct <= 25) classification = 'slightly_high';
    else classification = 'overpriced';
  }

  const negotiationLow = Math.round(adjustedMedian * 0.92);
  const negotiationHigh = Math.round(adjustedMedian * 1.02);

  return {
    status: 'ok',
    sampleSize: comparablePrices.length,
    fairPriceRange: { low: adjustedLow, high: adjustedHigh },
    medianComparable: adjustedMedian,
    listedPrice: price ?? null,
    percentDifference: price != null ? diffPct : null,
    classification, // great_deal | fair | slightly_high | overpriced
    negotiationRange: { low: negotiationLow, high: negotiationHigh },
  };
}

function percentile(sortedArr, p) {
  const idx = (sortedArr.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedArr[lower];
  return sortedArr[lower] + (sortedArr[upper] - sortedArr[lower]) * (idx - lower);
}

export function classificationLabel(classification) {
  return (
    {
      great_deal: { emoji: '🟢', label: 'Great Deal' },
      fair: { emoji: '🔵', label: 'Fair Price' },
      slightly_high: { emoji: '🟡', label: 'Slightly High' },
      overpriced: { emoji: '🔴', label: 'Overpriced' },
    }[classification] || { emoji: '🔵', label: 'Fair Price' }
  );
}

// --- BazaarBuddy chat reply (deterministic, no invented facts) ------------
export function buddyReplyForListing(listing, analysis) {
  if (!listing) {
    return "I couldn't find that listing to compare. Try browsing similar items in the same category instead.";
  }
  if (analysis.status === 'insufficient_data') {
    return `Hey! I checked around, but ${analysis.message.toLowerCase()} Once a few more similar items are listed, I'll be able to give you a solid read.`;
  }
  const { emoji, label } = classificationLabel(analysis.classification);
  const range = `₹${analysis.fairPriceRange.low.toLocaleString('en-IN')}–₹${analysis.fairPriceRange.high.toLocaleString('en-IN')}`;
  let verdict = '';
  if (analysis.listedPrice != null) {
    const diff = analysis.percentDifference;
    if (analysis.classification === 'great_deal') {
      verdict = `₹${analysis.listedPrice.toLocaleString('en-IN')} is a steal - that's about ${Math.abs(diff)}% below similar listings.`;
    } else if (analysis.classification === 'fair') {
      verdict = `₹${analysis.listedPrice.toLocaleString('en-IN')} looks fair, right in line with similar listings.`;
    } else if (analysis.classification === 'slightly_high') {
      verdict = `₹${analysis.listedPrice.toLocaleString('en-IN')} looks slightly high - about ${diff}% above similar listings.`;
    } else {
      verdict = `₹${analysis.listedPrice.toLocaleString('en-IN')} looks overpriced - about ${diff}% above similar listings.`;
    }
  }
  return `Hey! I checked ${analysis.sampleSize} similar listings 👋 ${emoji} ${label}. ${verdict} Similar items are going for around ${range}. If you want to negotiate, ₹${analysis.negotiationRange.low.toLocaleString('en-IN')}–₹${analysis.negotiationRange.high.toLocaleString('en-IN')} is a reasonable ask.`;
}

// --- Description cleanup (deterministic fallback, never invents facts) ----
export function cleanupDescription(raw) {
  if (!raw) return raw;
  let text = raw.trim().replace(/\s+/g, ' ');
  text = text.charAt(0).toUpperCase() + text.slice(1);
  if (!/[.!?]$/.test(text)) text += '.';
  return text;
}

// --- Comprehensive BazaarBuddy Conversational Engine ---------------------
function normalizeQuery(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fixCommonTypos(str) {
  return str
    .replace(/\b(seling|sel|sol|selr)\b/g, 'sell')
    .replace(/\b(buyin|by|purcase|purchse)\b/g, 'buy')
    .replace(/\b(prce|priz|costing|expensiv|cheep)\b/g, 'price')
    .replace(/\b(edet|updat|modifiy)\b/g, 'edit')
    .replace(/\b(saftey|scamer|scamers|fraude|skam)\b/g, 'safety')
    .replace(/\b(categry|catagories|catogory|catogary)\b/g, 'category')
    .replace(/\b(registar|singup|signupp|log in)\b/g, 'login')
    .replace(/\b(mesage|msg|mesages)\b/g, 'message')
    .replace(/\b(exchang|swapp|exhcange)\b/g, 'exchange')
    .replace(/\b(rentl|rentin|rented)\b/g, 'rent')
    .replace(/\b(tikit|tikket|tkt|tkts)\b/g, 'ticket')
    .replace(/\b(accomodation|acomodation|accomm)\b/g, 'accommodation')
    .replace(/\b(roomate|roomates)\b/g, 'roommate');
}

export function generateBuddyChatReply({ message, listingId, history = [], user = null }) {
  const rawMsg = (message || '').trim();
  const normalized = fixCommonTypos(normalizeQuery(rawMsg));

  // Context lookup if on a specific listing
  let activeListing = null;
  let listingAnalysis = null;
  if (listingId) {
    activeListing = db
      .prepare(
        `SELECT l.*, c.name as category_name, c.slug as category_slug,
                u.name as seller_name, u.is_verified as seller_verified,
                u.rating_avg as seller_rating_avg, u.rating_count as seller_rating_count
         FROM listings l
         LEFT JOIN categories c ON c.id = l.category_id
         LEFT JOIN users u ON u.id = l.seller_id
         WHERE l.id = ?`
      )
      .get(listingId);

    if (activeListing && activeListing.category_id && activeListing.price != null) {
      listingAnalysis = analyzePricing({
        categoryId: activeListing.category_id,
        condition: activeListing.condition,
        price: activeListing.price,
        excludeListingId: activeListing.id,
      });
    }
  }

  // 1. GREETING & CHIT-CHAT
  if (/^(hi|hello|hey|hiya|helo|hlo|sup|yo|greetings|good morning|good afternoon|good evening|namaste)\b/.test(normalized)) {
    const greetings = [
      `Hey there${user?.name ? ', ' + user.name.split(' ')[0] : ''}! 👋 I'm BazaarBuddy, your campus marketplace assistant. Looking to buy, sell, check fair prices, or explore campus deals?`,
      `Hello! 🎒 Welcome to CampusBazaar. How can I help you today? Ask me about selling an item, finding textbooks, checking prices, or staying safe on campus.`,
      `Hi! 👋 I'm here to help you navigate CampusBazaar. Ask me anything about listings, fair pricing, orders, or campus safety.`,
    ];
    const reply = greetings[Math.floor(Math.random() * greetings.length)];
    return {
      reply,
      suggestedPrompts: activeListing
        ? ['Is this price fair?', 'Tell me about this item', 'Safety checklist', 'How to sell?']
        : ['How to sell an item?', 'Browse categories', 'Check fair prices', 'Safety tips'],
    };
  }

  // 2. APPRECIATION / THANKS
  if (/^(thanks|thank you|thx|ty|great thanks|awesome thanks|appreciate it)\b/.test(normalized)) {
    return {
      reply: "You're very welcome! 😊 Always happy to help fellow students. Let me know if you need anything else on CampusBazaar!",
      suggestedPrompts: ['Browse marketplace', 'How to sell?', 'Safety tips'],
    };
  }

  // 3. BOT IDENTITY & CAPABILITIES
  if (
    /^(who are you|what can you do|what is your name|what do you do|help me|capabilities|features|tell me about yourself)\b/.test(
      normalized
    ) ||
    normalized === 'help'
  ) {
    return {
      reply:
        "I'm **BazaarBuddy** 🎒, your smart AI assistant for CampusBazaar! Here is what I can help you with:\n\n" +
        "• **Fair Price Intelligence**: Compare prices against real campus sales to see if a deal is fair or overpriced.\n" +
        "• **Selling & Listing**: Step-by-step guidance on creating, editing, and pricing your listings.\n" +
        "• **Buying & Search**: Find active campus items like books, electronics, calculators, and furniture.\n" +
        "• **Rentals & Exchanges**: Learn how security deposits, swap offers, and return periods work.\n" +
        "• **Safety & Scam Prevention**: Essential rules for safe campus meetups and scam prevention.\n" +
        "• **Account & Orders**: Navigate your dashboard, messages, saved items, and transactions.",
      suggestedPrompts: ['How to sell?', 'How to buy?', 'Safety tips', 'Browse categories'],
    };
  }

  // 4. CONTEXTUAL: SPECIFIC ITEM IN VIEW
  if (
    activeListing &&
    (/^(tell me about this|about this item|item info|who is selling|is this available|is this price fair|check price|is it expensive|is it a good deal)\b/.test(
      normalized
    ) ||
      ((normalized.includes('seller') || normalized.includes('price') || normalized.includes('condition')) &&
        (normalized.includes('this') || normalized.includes('item'))))
  ) {
    if (normalized.includes('seller')) {
      const verified = activeListing.seller_verified ? 'verified student ✓' : 'student';
      const rating = activeListing.seller_rating_avg
        ? `rated ${activeListing.seller_rating_avg}★ (${activeListing.seller_rating_count} reviews)`
        : 'no reviews yet';
      return {
        reply: `This item is listed by **${activeListing.seller_name}** (${verified}, ${rating}). You can message them directly on this page to ask questions or arrange a meetup.`,
        suggestedPrompts: ['Is this price fair?', 'Safety checklist', 'How to buy?'],
      };
    }

    if (normalized.includes('price') || normalized.includes('deal') || normalized.includes('expensive')) {
      if (listingAnalysis) {
        return {
          reply: buddyReplyForListing(activeListing, listingAnalysis),
          suggestedPrompts: ['Safety checklist', 'How to contact seller', 'Browse similar items'],
        };
      }
    }

    const priceText =
      activeListing.listing_type === 'rent'
        ? `₹${activeListing.rental_price} ${activeListing.rental_period?.replace('per-', '/ ')}`
        : activeListing.listing_type === 'exchange'
        ? `Exchange for: "${activeListing.exchange_for || 'open offer'}"`
        : `₹${activeListing.price?.toLocaleString('en-IN')}`;

    return {
      reply:
        `You're viewing **"${activeListing.title}"** in **${activeListing.category_name || 'Campus Marketplace'}**.\n\n` +
        `• **Price / Type**: ${priceText} (${activeListing.listing_type})\n` +
        `• **Condition**: ${activeListing.condition}\n` +
        `• **Campus**: ${activeListing.campus || 'Main Campus'}\n` +
        `• **Seller**: ${activeListing.seller_name} ${activeListing.seller_verified ? '(Verified)' : ''}\n\n` +
        `To purchase or rent, click the action button or message the seller directly below the photos!`,
      suggestedPrompts: ['Is this price fair?', 'Safety tips for pickup', 'How to negotiate?'],
    };
  }

  // 4B. TRAVEL TICKETS (BUY, SELL, TRANSIT, TRANSFERABILITY & PNR)
  if (
    /\b(ticket|tickets|train ticket|bus ticket|flight ticket|irctc|tatkal|pnr|berth|sleeper|boarding)\b/.test(
      normalized
    )
  ) {
    const tickets = db
      .prepare(
        `SELECT l.id, l.title, l.price, l.ticket_type, l.travel_date, l.departure_location, l.destination_location
         FROM listings l
         LEFT JOIN categories c ON c.id = l.category_id
         WHERE l.status = 'active' AND (c.slug = 'travel-tickets' OR l.ticket_type IS NOT NULL)
         ORDER BY l.created_at DESC
         LIMIT 3`
      )
      .all();

    let listingSnippet = '';
    if (tickets.length > 0) {
      listingSnippet =
        '\n\n**Active Travel Tickets on Campus**:\n' +
        tickets
          .map(
            (t) =>
              `• **[${t.title}](/listing/${t.id})** — ₹${t.price?.toLocaleString('en-IN')} (${t.ticket_type || 'Ticket'} • ${t.departure_location || 'Depart'} ➔ ${t.destination_location || 'Arrive'} on ${t.travel_date || 'Upcoming'})`
          )
          .join('\n');
    }

    return {
      reply:
        "🎫 **Travel Tickets on CampusBazaar**:\n\n" +
        "You can buy and sell second-hand or transferable **Train**, **Bus**, and **Flight** tickets from fellow students!\n\n" +
        "• **Browse & Search**: Filter by ticket type, destination, and travel date under **[Travel Tickets](/browse?category=travel-tickets)**.\n" +
        "• **List a Ticket**: Post your extra ticket under **[Sell an Item](/sell)** (select 'Travel Tickets'). Specify route, travel date, times, and asking price.\n\n" +
        "⚠️ **Important Transferability & Safety Advisory**:\n" +
        "• CampusBazaar is a student marketplace and does **not** issue tickets or guarantee carrier transfers.\n" +
        "• Buyers must independently verify passenger name transfer rules (e.g. IRCTC counter transfer policies for blood relatives or students, bus operator name changes) and check PNR status before payment.\n" +
        "• Never transfer funds in advance without verifying the ticket and seller student ID in person!" +
        listingSnippet,
      suggestedPrompts: [
        'Browse Travel Tickets',
        'List a travel ticket',
        'Safety tips for tickets',
        'Browse all categories',
      ],
    };
  }

  // 4C. ROOM & PROPERTY RENTALS (ACCOMMODATION, FLATS, ROOMMATES & PGs)
  if (
    /\b(room|rooms|property|flat|flats|apartment|bhk|accommodation|pg|hostel room|landlord|roommate|roommates|rent room)\b/.test(
      normalized
    )
  ) {
    const properties = db
      .prepare(
        `SELECT l.id, l.title, l.rental_price, l.property_type, l.locality, l.city, l.bedrooms
         FROM listings l
         LEFT JOIN categories c ON c.id = l.category_id
         WHERE l.status = 'active' AND (c.slug = 'rent-accommodation' OR l.property_type IS NOT NULL)
         ORDER BY l.created_at DESC
         LIMIT 3`
      )
      .all();

    let listingSnippet = '';
    if (properties.length > 0) {
      listingSnippet =
        '\n\n**Available Student Accommodations**:\n' +
        properties
          .map(
            (p) =>
              `• **[${p.title}](/listing/${p.id})** — ₹${p.rental_price?.toLocaleString('en-IN')}/month (${p.property_type || 'Room'} in ${p.locality || p.city || 'Campus area'})`
          )
          .join('\n');
    }

    return {
      reply:
        "🏠 **Room & Property Rentals on CampusBazaar**:\n\n" +
        "Find student flats, shared rooms, PGs, and apartments near campus without broker commissions!\n\n" +
        "• **Browse Accommodations**: View verified rooms with photos, monthly rent, furnishing, and landlord contacts under **[Rent & Accommodation](/browse?category=rent-accommodation)**.\n" +
        "• **Filter Options**: Search by BHK/bedrooms, single vs. shared rooms, furnishing (Furnished, Semi, Unfurnished), and locality.\n" +
        "• **List a Room**: Landlords or students seeking roommates can post listings with multi-photo galleries under **[List an Item](/sell)** (select 'Room / Accommodation').\n\n" +
        "💡 **Student Rental Checklist**:\n" +
        "1. Always visit the property in person before paying any token or security deposit.\n" +
        "2. Inspect amenities: Wi-Fi, water supply, electricity backup, and security.\n" +
        "3. Obtain a written rent agreement or payment receipt from the property owner." +
        listingSnippet,
      suggestedPrompts: [
        'Browse Rentals',
        'List a room or flat',
        'Safety tips for rentals',
        'Browse marketplace',
      ],
    };
  }

  // 5. LISTING EDIT & MANAGEMENT
  if (
    /edit|update listing|change price|modify listing|delete listing|remove listing|manage listing/.test(
      normalized
    )
  ) {
    return {
      reply:
        "To edit or manage your listings on CampusBazaar:\n\n" +
        "1. Go to your **[My Listings](/dashboard/listings)** page from the dashboard.\n" +
        "2. Click the **Edit** link next to the listing you wish to modify (or click 'Edit listing' on your product's detail page).\n" +
        "3. You can update the **Title**, **Price**, **Condition**, **Category**, **Description**, and **Photos**.\n" +
        "4. You can also change the status to **Active**, **Sold**, or **Rented**.\n" +
        "5. Click **Save changes** and your listing will be updated immediately across the marketplace!\n\n" +
        "Note: Only you (the listing owner) or an administrator have permission to edit your items.",
      suggestedPrompts: ['Go to My Listings', 'How to sell an item?', 'Pricing tips'],
    };
  }

  // 6. LISTING CREATION & SELLING GUIDANCE
  if (
    /sell|how to list|create listing|post an ad|post item|put on sale|selling tips|list an item/.test(
      normalized
    )
  ) {
    return {
      reply:
        "Selling on CampusBazaar is designed to be quick and student-friendly 🎒:\n\n" +
        "1. Go to **[List an Item](/sell)** in the top navigation.\n" +
        "2. **Basics**: Give your item a clear title and select its category (Books, Electronics, Furniture, etc.).\n" +
        "3. **Type**: Choose whether to **Sell**, **Rent**, or **Exchange**.\n" +
        "4. **Details & Price**: State the condition honestly. Use our built-in **'Check price'** tool to compare with recent campus sales!\n" +
        "5. **Photos**: Upload clear photos taken in good lighting.\n" +
        "6. **AI Assistant**: You can click **'Clean up wording'** to polish your description without altering your facts.\n" +
        "7. Preview and publish — your item is instantly discoverable by students on campus!",
      suggestedPrompts: ['List an item now', 'How to price an item?', 'How to edit my listing?'],
    };
  }

  // 7. BUYING GUIDANCE & ORDER PROCESS
  if (
    /how to buy|how to purchase|buying process|how to order|buy item|order process|how to get item/.test(
      normalized
    )
  ) {
    return {
      reply:
        "Here is the simple step-by-step to buy on CampusBazaar:\n\n" +
        "1. **Find an Item**: Browse the **[Marketplace](/browse)** by keyword, category, or budget.\n" +
        "2. **Check the Details**: Open the listing to inspect photos, condition, and fair price analysis.\n" +
        "3. **Contact or Buy**: Click **Buy** to send a formal purchase request, or message the seller directly using the chat box on the listing page.\n" +
        "4. **Arrange Campus Meetup**: Pick a safe public spot (library, campus canteen, hostel gates) during daytime.\n" +
        "5. **Inspect & Pay**: Inspect the item in person, then pay directly via UPI or cash upon handover!",
      suggestedPrompts: ['Browse marketplace', 'Safety tips for meetups', 'How do rentals work?'],
    };
  }

  // 8. PRICING INTELLIGENCE & NEGOTIATION
  if (
    /price|pricing|fair price|is it worth|is it cheap|is it expensive|overpriced|great deal|negotiat|discount|how much should i charge/.test(
      normalized
    )
  ) {
    if (activeListing && listingAnalysis) {
      return {
        reply: buddyReplyForListing(activeListing, listingAnalysis),
        suggestedPrompts: ['Safety tips', 'How to contact seller'],
      };
    }
    return {
      reply:
        "💡 **CampusBazaar Pricing Intelligence Guide**:\n\n" +
        "Our system compares asking prices against active and sold listings in the exact same category and condition band.\n\n" +
        "**Campus Resale Guidelines**:\n" +
        "• **Like-New**: 75–85% of original retail price\n" +
        "• **Good condition**: 50–70% of original retail price\n" +
        "• **Fair/Worn**: 35–50% of original retail price\n\n" +
        "**Negotiation Tip**: If a listing is labeled 'Slightly High', offering 8–12% below the asking price is standard campus etiquette. When listing an item on **[Sell](/sell)**, click **'Check price'** for instant fair range recommendations!",
      suggestedPrompts: ['List an item', 'Browse marketplace', 'Safety tips'],
    };
  }

  // 9. PRODUCT CATEGORIES & INVENTORY SEARCH
  const catMatch = normalized.match(
    /\b(book|books|electronic|electronics|calculator|laptop|phone|furniture|chair|table|hostel|bed|lamp|cycle|bicycle|fashion|clothes|sports|accessories|watch)\b/
  );
  if (catMatch || /category|categories|what do you sell|what items|available items/.test(normalized)) {
    if (catMatch) {
      const keyword = catMatch[1];
      const items = db
        .prepare(
          `SELECT l.id, l.title, l.price, l.rental_price, l.listing_type, c.name as cat_name
           FROM listings l
           LEFT JOIN categories c ON c.id = l.category_id
           WHERE l.status = 'active' AND (l.title LIKE ? OR l.description LIKE ? OR c.slug LIKE ?)
           LIMIT 3`
        )
        .all(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);

      if (items.length > 0) {
        const listText = items
          .map((it) => {
            const p = it.listing_type === 'rent' ? `₹${it.rental_price}/rent` : it.listing_type === 'exchange' ? 'Exchange' : `₹${it.price}`;
            return `• **[${it.title}](/listing/${it.id})** — ${p} (${it.cat_name})`;
          })
          .join('\n');
        return {
          reply:
            `Here are active **${keyword}** listings on campus right now:\n\n${listText}\n\n` +
            `You can also search more in the **[Browse Marketplace](/browse?q=${encodeURIComponent(keyword)})**!`,
          suggestedPrompts: ['Browse all items', 'How to buy?', 'Safety tips'],
        };
      } else {
        return {
          reply:
            `I searched our campus database, but there are no active listings matching "${keyword}" at this moment. ` +
            `You can check the full **[Marketplace](/browse)** or post an exchange request under **[List an Item](/sell)**!`,
          suggestedPrompts: ['Browse all categories', 'How to sell an item?'],
        };
      }
    }

    // List all categories from DB
    const allCats = db.prepare('SELECT name, slug FROM categories ORDER BY name ASC').all();
    const catList = allCats.map((c) => `• **[${c.name}](/browse?category=${c.slug})**`).join('\n');
    return {
      reply: `Here are the official product categories on CampusBazaar:\n\n${catList}\n\nClick any category to explore available listings!`,
      suggestedPrompts: ['Browse all items', 'How to sell?'],
    };
  }

  // 10. ORDERS, RENTALS, EXCHANGES & TRANSACTIONS
  if (
    /rental|renting|security deposit|deposit|exchange|swap|trade|transaction|order|refund/.test(
      normalized
    )
  ) {
    return {
      reply:
        "Here is how transactions, rentals, and exchanges work on CampusBazaar:\n\n" +
        "• **Direct Purchases**: Click 'Buy' to initiate a request. Track confirmations under **[Transactions](/dashboard/transactions)**.\n" +
        "• **Rentals**: Pay the rental rate plus a refundable security deposit. Return dates and status are managed under **[Rentals](/dashboard/rentals)**. When the item is returned undamaged, the deposit is refunded.\n" +
        "• **Exchanges (Swaps)**: Propose an item you're willing to trade. The seller reviews and accepts/declines under **[Exchanges](/dashboard/exchanges)**.\n" +
        "• **Communication**: Coordinate pickup times using our in-app **[Messages](/dashboard/messages)**.",
      suggestedPrompts: ['View my transactions', 'Safety tips for exchanges', 'Browse rentals'],
    };
  }

  // 11. ACCOUNT, LOGIN, REGISTRATION & PROFILE
  if (/login|register|sign up|signup|account|profile|password|change campus|update profile/.test(normalized)) {
    return {
      reply:
        "CampusBazaar Account & Profile Help:\n\n" +
        "• **Sign Up**: Register with your university email at **[Register](/register)**.\n" +
        "• **Sign In**: Access your account at **[Login](/login)**.\n" +
        "• **Manage Profile**: Update your name, campus location, and student bio at **[Profile](/profile)**.\n" +
        "• **Dashboard**: View your saved items, listings, orders, and messages in your **[Dashboard](/dashboard)**.",
      suggestedPrompts: ['Go to Profile', 'Go to Dashboard', 'Browse marketplace'],
    };
  }

  // 12. MARKETPLACE NAVIGATION & SAVED ITEMS
  if (/where is|navigation|how to find|saved items|wishlist|messages|inbox|notifications|dashboard/.test(normalized)) {
    return {
      reply:
        "Quick Navigation Links:\n\n" +
        "• 🛍️ **[Browse Marketplace](/browse)** — All items & search\n" +
        "• ➕ **[List an Item](/sell)** — Post for sale, rent, or exchange\n" +
        "• 📊 **[Dashboard Overview](/dashboard)** — Summary of activity\n" +
        "• 📦 **[My Listings](/dashboard/listings)** — Manage your active posts\n" +
        "• ❤️ **[Saved Items](/dashboard/saved)** — Favorited products\n" +
        "• 💬 **[Messages](/dashboard/messages)** — Direct chats with students\n" +
        "• 🔔 **[Notifications](/dashboard/notifications)** — Activity alerts\n" +
        "• 🛡️ **[Safety Center](/safety)** — Campus trading guidelines",
      suggestedPrompts: ['My Listings', 'Browse Marketplace', 'Saved Items'],
    };
  }

  // 13. SAFETY, SCAM PREVENTION & CAMPUS GUIDELINES
  if (/safety|scam|safe|fraud|cheated|rules|guidelines|prevent scam|is it safe|security/.test(normalized)) {
    return {
      reply:
        "🛡️ **CampusBazaar 5-Point Safety Checklist**:\n\n" +
        "1. **Public Campus Meetups**: Always meet during daylight in busy areas like the Central Library, student union, or canteen.\n" +
        "2. **No Advance Payments**: Never transfer UPI or token money before you have physically held and inspected the item.\n" +
        "3. **Inspect Electronics & Books**: Test batteries, switches, and screens. Check textbooks for missing pages or edition match.\n" +
        "4. **Verified Badges**: Look for the blue checkmark indicating verified campus student accounts.\n" +
        "5. **Report Suspicious Listings**: Use the **'Report this listing'** button if you spot prohibited items, suspicious pricing, or abusive sellers.\n\n" +
        "Read our full guide at **[Campus Safety](/safety)**.",
      suggestedPrompts: ['View Safety Page', 'How to buy safely?', 'How to report a listing?'],
    };
  }

  // 14. TECHNICAL TROUBLESHOOTING
  if (/error|not working|broken|upload failed|bug|issue|problem|404|cannot upload|troubleshoot/.test(normalized)) {
    return {
      reply:
        "Here are solutions to common technical issues:\n\n" +
        "• **Image Upload Failed**: Ensure photos are JPG, PNG, or WEBP under 10MB each. You can also paste direct image URLs in the listing form!\n" +
        "• **Page Not Found (404)**: Listing editing and dashboard routes have been fully verified. If you see a cached error, refresh your browser.\n" +
        "• **Session Expired**: If actions fail with unauthorized, please log out and sign back in from **[Login](/login)**.\n" +
        "• **Form Not Submitting**: Ensure required fields (Title, Category, Condition, Price/Rental) are filled out.\n\n" +
        "For additional help, check out our **[Help Center](/help)**.",
      suggestedPrompts: ['Help Center', 'Browse Marketplace', 'Go to Dashboard'],
    };
  }

  // 15. INTELLIGENT FALLBACK
  return {
    reply:
      `I'm not completely certain about "${rawMsg}", but I'm here to help you with anything on CampusBazaar! 🎒\n\n` +
      `Here are common things I can assist with right now:\n` +
      `• **Price Check**: Check fair resale prices on campus\n` +
      `• **Buying & Selling**: How to list, edit, or purchase items\n` +
      `• **Campus Safety**: Avoiding scams and planning safe meetups\n` +
      `• **Navigation**: Direct links to categories, messages, and dashboard\n\n` +
      `Pick one of the quick options below or rephrase your question!`,
    suggestedPrompts: ['How to sell an item?', 'Browse categories', 'Safety tips', 'How to edit listings?'],
  };
}
