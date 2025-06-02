'use strict';

const Archetype = require('archetype');
const mongoose = require('mongoose');

const CreateChatMessageParams = new Archetype({
  chatThreadId: {
    $type: mongoose.Types.ObjectId
  },
  userId: {
    $type: mongoose.Types.ObjectId
  },
  content: {
    $type: String
  }
}).compile('CreateChatMessageParams');

const systemPrompt = `
You are a data querying assistant who writes scripts for users accessing MongoDB data using Node.js and Mongoose.

Keep scripts concise. Avoid unnecessary comments and error handling, unless explicitly asked for by the user.

Assume the user has pre-defined schemas and models. Do not define any new schemas or models for the user.

Use async/await where possible. Assume top-level await is allowed.

Format output as Markdown, including code fences for any scripts the user requested.

Add a brief text description of what the script does.

If the user's query is best answered with a chart, return a Chart.js 4 configuration as \`return { $chart: chartJSConfig };\`

Example output:

The following script counts the number of users which are not deleted.

\`\`\`javascript
const users = await db.model('User').find({ isDeleted: false });
return { numUsers: users.length };
\`\`\`

-----------

Here is a description of the user's models. Assume these are the only models available in the system unless explicitly instructed otherwise by the user.

Vehicle (collection name: Vehicle)
  - _id: ObjectId
  - userId: ObjectId (ref User)
  - authorizedUsers: Array
  - status: String
  - _previousStatus: String
  - make: String
  - model: String
  - year: Number
  - color: String
  - nickName: String
  - tollTagId: String
  - availabilityDate: String
  - vehicleFeatures: Array
  - vehicleIdentityId: ObjectId (ref VehicleIdentity)
  - images: Object
  - thumbnail: String
  - photos: Array
  - registrationPhoto: String
  - smartcarId: String
  - smartcarPermissions: Array
  - percentRemaining: Number
  - range: Number
  - location: Object
  - locationTimestamp: Date
  - pricePerMonth: Number
  - pricePerWeek: Number
  - returnAddress: String
  - returnLocation: Object
  - description: String
  - maxUnlockRadiusMiles: Number
  - returnRadiusKM: Number
  - numReviews: Number
  - numCompletedTrips: Number
  - totalReviewScore: Number
  - totalRevenueGenerated: Number
  - bookingsCount: Number
  - odometer: Number
  - pickupInstructions: String
  - returnInstructions: String
  - unlockInstructions: String
  - chargingState: String
  - isPluggedIn: Boolean
  - currentBookingId: ObjectId (ref Booking)
  - maxTripLengthDays: Number
  - smartcarWebhookIds: Array
  - lastErrorMessage: String
  - vinNumber: String
  - licensePlate: String
  - licensePlateState: String
  - registrationExpirationDate: String
  - style: Object
  - driveUnit: Object
  - efficiencyPackage: String
  - performancePackage: String
  - connectivityProvider: String
  - abiId: String
  - platformFeePercentage: Number
  - promotionsEnabled: Boolean
  - modelDescription: String
  - isConcierge: Boolean
  - lastLoadedSuperchargerInvoicesAt: Date
  - privateBookingNotes: String
  - publicMarketingNotes: String
  - fleetKeyState: Object
  - weakBattery: Boolean
  - fleetITconnectionStartDate: Date
  - fleetITId: Number
  - interiorTrim: String
  - skipLoadingSuperchargerInvoices: Boolean
  - chargeKey: Object
  - securityDepositPerUser: Array

User (collection name User)
  - _id: ObjectId
  - firstName: String
  - lastName: String
  - email: String (required, lowercase)
  - picture: String
  - zipCode: String
  - telephone: String
  - verifiedTelephone: Boolean
  - verifiedEmail: Boolean
  - googleUserId: String
  - appleUserId: String
  - smartcarUserId: String
  - stripeCustomerId: String
  - roles: Array of String (enum: 'root', 'admin', 'manager', 'host', 'verified-driver', 'internal-tester', 'authorized-payer')
  - accountPreference: String (enum: 'host', 'guest', 'both')
  - defaultPaymentMethodId: ObjectId (ref PaymentMethod)
  - personaInquiryId: String
  - personaAccountId: String
  - personaInquiryStatus: String (enum: 'created', 'approved', 'declined')
  - personaHasDriverLicense: Boolean
  - driverLicenseState: String
  - numReviews: Number
  - totalReviewScore: Number
  - needsSmartcarReconnect: Boolean
  - isFrozen: Boolean
  - instantTransactions: Boolean
  - publicNotes: String
  - bookingNotes: String
  - hostOnboarding: Object
  - guestOnboarding: Object
  - canUseApp: Boolean
  - useWalletForChargeReceipt: Boolean
  - appOnboardingToken: Object
  - addedToLaunchlist: Boolean
  - stripeAccountId: String
  - isStripeConnectedAccountConfirmed: Boolean
  - requestedAccountDeletion: Boolean
  - qrcodeUrl: String
  - checkrCandidateId: String
  - checkrInvitationId: String
  - checkrInvitationUrl: String
  - checkrInvitationStatus: String
  - referralCode: String
  - referralUrl: String
  - referralConversionId: ObjectId (ref ReferralConversion)
  - abiOwnerId: String
  - abiRenterId: String
  - driverLicense: Object
  - securityDeposit: Number
  - tripcityOwnerId: String
  - bannedUserId: ObjectId (ref BannedUser)
  - isConcierge: Boolean
  - lastHostDashboardLoginAt: Date
  - internalSlackChannel: String
  - skipLoadingSuperchargerInvoices: Boolean
`.trim();

module.exports = ({ db }) => async function createChatMessage(params) {
  const { chatThreadId, userId, content, script } = new CreateChatMessageParams(params);
  const ChatThread = db.model('__Studio_ChatThread');
  const ChatMessage = db.model('__Studio_ChatMessage');

  // Check that the user owns the thread
  const chatThread = await ChatThread.findOne({ _id: chatThreadId });
  if (!chatThread) {
    throw new Error('Chat thread not found');
  }
  if (userId != null && chatThread.userId.toString() !== userId.toString()) {
    throw new Error('Not authorized');
  }

  const messages = await ChatMessage.find({ chatThreadId }).sort({ createdAt: 1 });
  const llmMessages = messages.map(m => ({
    role: m.role,
    content: m.content
  }));
  llmMessages.push({ role: 'user', content });

  if (chatThread.title == null) {
    getChatCompletion([
      { role: 'system', content: 'Summarize the following chat thread in 6 words or less, as a helpful thread title' },
      ...llmMessages
    ]).then(res => {
      const title = res.choices?.[0]?.message?.content;
      chatThread.title = title;
      return chatThread.save();
    }).catch(() => {});
  }

  llmMessages.unshift({
    role: 'system',
    content: systemPrompt
  });

  // Create the chat message and get OpenAI response in parallel
  const chatMessages = await Promise.all([
    ChatMessage.create({
      chatThreadId,
      role: 'user',
      content,
      script,
      executionResult: null
    }),
    getChatCompletion(llmMessages).then(res => {
      const content = res.choices?.[0]?.message?.content || '';
      console.log('Content', content, res);
      return ChatMessage.create({
        chatThreadId,
        role: 'assistant',
        content
      });
    })
  ]);

  return { chatMessages };
};

async function getChatCompletion(messages, options = {}) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 2500,
      ...options,
      messages
    })
  });

  return await response.json();
};
