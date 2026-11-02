import assert from 'node:assert';

const BASE_URL = 'http://localhost:4000/api';

async function req(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
  }
  return data;
}

async function run() {
  console.log('=== STARTING FULL END-TO-END VERIFICATION ===\n');

  // Step 1: Login
  console.log('1. Authenticating as demo student...');
  const loginRes = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'ananya@campus.edu', password: 'password123' }),
  });
  const token = loginRes.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log('✓ Logged in as:', loginRes.user.name, `(${loginRes.user.email})`);

  // Step 2: Get categories
  console.log('\n2. Verifying categories in database...');
  const catRes = await req('/categories');
  const travelCat = catRes.categories.find((c) => c.slug === 'travel-tickets');
  const rentCat = catRes.categories.find((c) => c.slug === 'rent-accommodation');
  const elecCat = catRes.categories.find((c) => c.slug === 'electronics') || catRes.categories[0];
  assert(travelCat, 'Travel Tickets category must exist');
  assert(rentCat, 'Rent & Accommodation category must exist');
  console.log('✓ Found Travel Tickets (ID:', travelCat.id, ')');
  console.log('✓ Found Rent & Accommodation (ID:', rentCat.id, ')');

  const createdIds = [];

  // Step 3: Create Normal Product Listing
  console.log('\n3. Testing Normal Product listing creation...');
  const normalRes = await req('/listings', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'TEST Scientific Calculator FX-991EX',
      categoryId: elecCat.id,
      listingType: 'sell',
      condition: 'like-new',
      price: 850,
      originalPrice: 1400,
      description: 'Used for one semester in Engineering Mathematics. Excellent condition.',
      campus: 'North Campus',
      images: ['https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?w=400'],
    }),
  });
  createdIds.push(normalRes.listing.id);
  console.log('✓ Normal product created, ID:', normalRes.listing.id, 'Price: ₹' + normalRes.listing.price);

  // Step 4: Create Train Ticket Listing
  console.log('\n4. Testing Train Ticket listing creation...');
  const trainRes = await req('/listings', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'TEST Delhi to Mumbai Rajdhani Express 2AC',
      categoryId: travelCat.id,
      ticketType: 'Train Ticket',
      travelDate: '2026-11-20',
      departureLocation: 'New Delhi Railway Station (NDLS)',
      destinationLocation: 'Mumbai Central (MMCT)',
      departureTime: '16:55',
      arrivalTime: '08:35',
      ticketQuantity: 2,
      price: 1950,
      originalPrice: 2250,
      description: 'Transferable 2AC confirmed berth ticket. Coach B3 Berth 21-22.',
      campus: 'North Campus',
    }),
  });
  createdIds.push(trainRes.listing.id);
  assert.strictEqual(trainRes.listing.ticketType, 'Train Ticket');
  assert.strictEqual(trainRes.listing.departureLocation, 'New Delhi Railway Station (NDLS)');
  assert.strictEqual(trainRes.listing.destinationLocation, 'Mumbai Central (MMCT)');
  assert.strictEqual(trainRes.listing.travelDate, '2026-11-20');
  assert.strictEqual(trainRes.listing.ticketQuantity, 2);
  console.log('✓ Train ticket created, ID:', trainRes.listing.id, 'Route:', trainRes.listing.departureLocation, '➔', trainRes.listing.destinationLocation);

  // Step 5: Create Bus Ticket Listing
  console.log('\n5. Testing Bus Ticket listing creation...');
  const busRes = await req('/listings', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'TEST Delhi to Manali Volvo Luxury Semi-Sleeper',
      categoryId: travelCat.id,
      ticketType: 'Bus Ticket',
      travelDate: '2026-11-25',
      departureLocation: 'Kashmere Gate ISBT',
      destinationLocation: 'Manali Private Bus Stand',
      departureTime: '19:30',
      arrivalTime: '09:00',
      ticketQuantity: 1,
      price: 950,
      originalPrice: 1200,
      description: 'AC Volvo Multi-Axle sleeper bus seat. Water bottle and charging points included.',
      campus: 'Hostel C',
    }),
  });
  createdIds.push(busRes.listing.id);
  assert.strictEqual(busRes.listing.ticketType, 'Bus Ticket');
  console.log('✓ Bus ticket created, ID:', busRes.listing.id, 'Destination:', busRes.listing.destinationLocation);

  // Step 6: Create Flight Ticket Listing
  console.log('\n6. Testing Flight Ticket listing creation...');
  const flightRes = await req('/listings', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'TEST Delhi to Bengaluru Indigo Direct Flight',
      categoryId: travelCat.id,
      ticketType: 'Flight Ticket',
      travelDate: '2026-12-05',
      departureLocation: 'Indira Gandhi Airport (DEL) T1',
      destinationLocation: 'Bengaluru Airport (BLR) T1',
      departureTime: '06:15',
      arrivalTime: '09:00',
      ticketQuantity: 1,
      price: 3900,
      originalPrice: 5100,
      description: 'Indigo Flight 6E-205. Includes 15kg check-in baggage and 7kg cabin bag.',
      campus: 'South Campus',
    }),
  });
  createdIds.push(flightRes.listing.id);
  assert.strictEqual(flightRes.listing.ticketType, 'Flight Ticket');
  console.log('✓ Flight ticket created, ID:', flightRes.listing.id, 'Flight:', flightRes.listing.title);

  // Step 7: Create Rental Property Listing with Room Images
  console.log('\n7. Testing Rental Property listing creation...');
  const propRes = await req('/listings', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'TEST Furnished 1 BHK Student Flat near North Campus',
      categoryId: rentCat.id,
      propertyType: '1 BHK',
      rentalPrice: 11500,
      securityDeposit: 15000,
      locality: 'Hudson Lane, GTB Nagar',
      city: 'Delhi',
      address: 'Flat 301, Sunshine Heights',
      bedrooms: 1,
      bathrooms: 1,
      furnishing: 'Furnished',
      availableFrom: '2026-11-15',
      contactInfo: '+91 98765 43210 (WhatsApp / Calls)',
      description: 'Fully furnished with bed, study table, AC, Wi-Fi, and refrigerator. 5 mins walk to metro.',
      images: [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600',
      ],
      campus: 'North Campus',
    }),
  });
  createdIds.push(propRes.listing.id);
  assert.strictEqual(propRes.listing.propertyType, '1 BHK');
  assert.strictEqual(propRes.listing.locality, 'Hudson Lane, GTB Nagar');
  assert.strictEqual(propRes.listing.rentalPrice, 11500);
  assert.strictEqual(propRes.listing.images.length, 2);
  console.log('✓ Rental property created, ID:', propRes.listing.id, 'Rent: ₹' + propRes.listing.rentalPrice + '/mo', 'Images:', propRes.listing.images.length);

  // Step 8: Edit Train Ticket Listing
  console.log('\n8. Testing editing Train Ticket listing (PATCH /listings/:id)...');
  const editTicketRes = await req(`/listings/${trainRes.listing.id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      price: 1800,
      departureTime: '17:15',
      destinationLocation: 'Borivali (BVI)',
      status: 'active',
    }),
  });
  assert.strictEqual(editTicketRes.listing.price, 1800);
  assert.strictEqual(editTicketRes.listing.departureTime, '17:15');
  assert.strictEqual(editTicketRes.listing.destinationLocation, 'Borivali (BVI)');
  console.log('✓ Train ticket updated and verified:', editTicketRes.listing.price, 'Route:', editTicketRes.listing.departureLocation, '➔', editTicketRes.listing.destinationLocation);

  // Step 9: Edit Rental Property Listing
  console.log('\n9. Testing editing Rental Property listing (PATCH /listings/:id)...');
  const editPropRes = await req(`/listings/${propRes.listing.id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      rentalPrice: 11000,
      bedrooms: 2,
      furnishing: 'Semi-furnished',
      title: 'TEST Semi-Furnished 2 BHK Student Flat near North Campus',
    }),
  });
  assert.strictEqual(editPropRes.listing.rentalPrice, 11000);
  assert.strictEqual(editPropRes.listing.bedrooms, 2);
  assert.strictEqual(editPropRes.listing.furnishing, 'Semi-furnished');
  console.log('✓ Rental property updated and verified:', editPropRes.listing.title, 'Bedrooms:', editPropRes.listing.bedrooms, 'Rent: ₹' + editPropRes.listing.rentalPrice);

  // Step 10: Marketplace Search & Category Filters
  console.log('\n10. Testing marketplace search and category filtering...');
  
  // Test ticket category filter
  const ticketList = await req('/listings?category=travel-tickets');
  console.log(`✓ GET /listings?category=travel-tickets returned ${ticketList.total} listings`);
  assert(ticketList.total >= 3, 'Should return at least 3 tickets');

  // Test ticketType filter
  const trainOnly = await req('/listings?category=travel-tickets&ticketType=Train+Ticket');
  console.log(`✓ Filter ticketType=Train Ticket returned ${trainOnly.total} listings`);
  assert(trainOnly.listings.every((l) => l.ticketType === 'Train Ticket'), 'All listings must be Train Ticket');

  // Test destination filter
  const manaliFilter = await req('/listings?category=travel-tickets&destination=Manali');
  console.log(`✓ Filter destination=Manali returned ${manaliFilter.total} listings`);
  assert(manaliFilter.total >= 1, 'Should find the Manali ticket');

  // Test rental category filter
  const rentList = await req('/listings?category=rent-accommodation');
  console.log(`✓ GET /listings?category=rent-accommodation returned ${rentList.total} listings`);
  assert(rentList.total >= 1, 'Should return at least 1 property');

  // Test property city/locality filter
  const gtbFilter = await req('/listings?category=rent-accommodation&city=Hudson');
  console.log(`✓ Filter city=Hudson returned ${gtbFilter.total} listings`);
  assert(gtbFilter.total >= 1, 'Should find the Hudson Lane flat');

  // Step 11: BazaarBuddy AI Chatbot Verification
  console.log('\n11. Testing BazaarBuddy AI chat for Ticket & Accommodation inquiries...');
  
  // Test 11a: Ticket inquiry
  const aiTicket = await req('/ai/chat', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ message: 'Can I sell my train ticket from Delhi to Mumbai?' }),
  });
  console.log('✓ AI Ticket Reply excerpt:', aiTicket.reply.slice(0, 150).replace(/\n/g, ' ') + '...');
  assert(aiTicket.reply.toLowerCase().includes('travel ticket') || aiTicket.reply.toLowerCase().includes('transferable'), 'AI must understand travel ticket queries');

  // Test 11b: Accommodation inquiry
  const aiRent = await req('/ai/chat', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ message: 'I need a 1 BHK flat or room near campus' }),
  });
  console.log('✓ AI Accommodation Reply excerpt:', aiRent.reply.slice(0, 150).replace(/\n/g, ' ') + '...');
  assert(aiRent.reply.toLowerCase().includes('accommodation') || aiRent.reply.toLowerCase().includes('room') || aiRent.reply.toLowerCase().includes('flat'), 'AI must understand room queries');

  // Step 12: Clean up test records
  console.log('\n12. Cleaning up test records...');
  for (const id of createdIds) {
    await req(`/listings/${id}`, { method: 'DELETE', headers: authHeaders });
    console.log('✓ Cleaned up test listing ID:', id);
  }

  console.log('\n=============================================');
  console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  console.log('=============================================');
}

run().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
