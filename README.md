# Lingua Forge

A magical workshop game where you forge Hebrew word crystals to rebuild a lost language.

## Game Overview

Players run a workshop that produces "word crystals" to reconstruct ancient texts about magic. The game involves:

- **Striking letters**: Generate Hebrew letters using the Strike button
- **Forging words**: Use molds to combine letters into Hebrew words
- **Building verses**: Arrange words to reconstruct lines of ancient texts
- **Hiring scribes**: Automate letter production with Apprentice Scribes
- **Managing resources**: Convert letters and words to Ink for upgrades

## Project Structure

The application is modularized into separate files for maintainability:

```
LinguaForge/
├── index.html          # Main HTML structure
├── css/
│   └── styles.css      # All styling
├── js/
│   ├── app.js          # Main entry point and game loop
│   ├── config.js       # Constants and configuration
│   ├── state.js        # Game state management
│   ├── letters.js      # Letter tile system
│   ├── molds.js        # Mold and word system
│   ├── scribes.js      # Scribe automation system
│   ├── grammar.js      # Verse/grammar checking
│   └── ui.js           # UI rendering
└── README.md
```

## Module Descriptions

### `config.js`
Contains all game constants and configuration:
- Scribe costs and cycle times
- Currency conversion rates
- Hebrew grammar lexicon
- Current line/verse data

### `state.js`
Centralized game state management:
- Player resources (letters, ink)
- Inventory (words, scribes)
- Current verse assembly
- Provides getters/setters for state modifications

### `letters.js`
Letter tile system:
- Letter generation
- Drag-and-drop mechanics
- Letter consumption and selling

### `molds.js`
Word forging system:
- Mold navigation
- Word creation from filled molds
- Inventory management

### `scribes.js`
Apprentice Scribe system:
- Hiring and management
- Automatic letter production
- Progress tracking

### `grammar.js`
Verse assembly and checking:
- Word placement in verse area
- Grammar evaluation
- Verse completion detection

### `ui.js`
UI rendering logic:
- Stats display updates
- Word and mold rendering
- Scribe visualization
- Grammar feedback

### `app.js`
Main application:
- Initialization
- Event handlers
- Game loop management

## How to Run

Since the app uses ES6 modules, it must be served over HTTP (not opened directly as a file):

```bash
# Using Python 3
python3 -m http.server 8000

# Or using Node.js
npx http-server

# Then open http://localhost:8000 in your browser
```

## Gameplay

1. **Generate Letters**: Click the "Strike" button to generate Hebrew letters
2. **Fill Molds**: Drag letters onto mold slots (they must match the letter shown)
3. **Forge Words**: Click "Forge" when a mold is complete to add the word to inventory
4. **Build Verse**: Drag words from inventory into the verse area
5. **Enscribe**: When the verse is correctly assembled, click "Enscribe" to complete the line
6. **Sell Resources**: Drag letters or sell words to get Ink
7. **Hire Scribes**: Use Ink to hire Apprentice Scribes for automatic letter generation

## Standard Coding Practices Applied

- **Separation of Concerns**: Each module has a single responsibility
- **ES6 Modules**: Clean import/export structure
- **State Management**: Centralized state with controlled mutations
- **DRY Principle**: Reusable functions for common operations
- **Clear Naming**: Descriptive function and variable names
- **Documentation**: JSDoc comments for all functions
- **Const/Let**: Proper use of modern JavaScript variable declarations

## Future Enhancements

- Multiple texts/verses
- Upgrade system (mentioned in UI but not implemented)
- Save/load functionality
- Additional word crafting mechanics
- More complex grammar rules
