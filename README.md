# QuestLog

QuestLog is a gamified self-improvement web application that turns real-world habits, goals, and activities into quests within a playful 2D virtual environment. The app is designed to motivate consistency, reflection, and personal growth through game mechanics, customization, and light social interaction.

## Live Website Link
https://questlog-hocl.onrender.com/

## Core Features

### User Accounts & Authentication
- Secure user authentication via Google OAuth
- Automatic account creation for new users on first login
- Persistent user data stored in MongoDB

### Quest System
- Built-in quests curated by the app (e.g. productivity, health, social, and exploration goals)
- Custom quests created by users with configurable titles, descriptions, rarity, and rewards
- Quest rarity tiers that affect XP and coin rewards
- Ability to accept, complete, and track quests over time
- Separation between built-in quests and user-generated quests

### Progression & Rewards
- XP-based leveling system with increasing XP thresholds
- Coin currency earned from completing quests
- Real-time updates to XP, level, and coin balance
- Visual XP progress bar to track advancement toward the next level

### Journaling & Reflection
- Journal entries attached to completed quests
- Text reflections saved per quest completion
- Optional photo uploads to accompany journal entries
- Sorting and filtering of journal entries by source, recency, and search
- Persistent storage of journals for long-term progress tracking

### Virtual Room & Customization
- Interactive 2D room rendered on a canvas
- Placeable furniture and items purchased with in-game coins
- Drag-and-drop item placement with collision and boundary handling
- Item scaling and positioning with visual constraints
- Customizable wallpapers and room themes
- Persistent room state saved per user

### Inventory & Shop
- In-game shop containing cosmetic items and furniture
- Inventory system for owned items
- Limits on how many times certain items can be placed
- Ability to buy, place, and remove items from the room

### Social Features
- Unique friend codes for each user
- Add friends via friend codes
- View friends and visit their rooms
- Real-time awareness of room ownership and viewer state

### Realtime Updates (Sockets)
- Live synchronization for room interactions and state updates
- Server-to-client communication for interactive features
- Socket system included but modular and removable if not needed

### UI & Experience
- Hand-drawn / sketch-style UI aesthetic
- Responsive layout for different screen sizes
- Modular React component architecture
- Clear separation between app sections (Home, Quests, Journal, Social)

## Purpose

QuestLog is built to make self-improvement feel engaging rather than overwhelming by blending productivity tools with game design. By rewarding consistency, reflection, and exploration, the app encourages users to build habits while expressing themselves creatively through customization and progress visualization.
