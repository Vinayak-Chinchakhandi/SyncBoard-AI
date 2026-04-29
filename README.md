# SyncBoard AI

SyncBoard AI is a real-time collaborative whiteboard that enables multiple users to create, edit, and interact with diagrams simultaneously, enhanced with AI-powered diagram generation.

---

## Features

- Real-time multi-user collaboration using Socket.io  
- Interactive canvas with shapes, text, arrows, and freehand drawing  
- Object-based system where all elements are selectable, editable, movable, and deletable  
- Predefined editable diagram templates (flowchart, decision tree, hierarchy, etc.)  
- AI-powered text-to-flowchart and diagram generation  
- Undo / Redo functionality  
- Drag and drop interaction  
- Export canvas as PNG  
- Fully mobile responsive with touch support  

---

## AI Capabilities

- Convert plain text into structured flowcharts  
- Generate diagrams automatically using Gemini API  
- AI-generated outputs are converted into fully editable canvas objects  

---

## Tech Stack

### Frontend
- React.js  
- Tailwind CSS  
- HTML5 Canvas  

### Backend
- Node.js  
- Express.js  

### Realtime Communication
- Socket.io  

### Database
- SQLite  

### AI Integration
- Gemini API  

---

## Core Architecture

- Objects Array → Single source of truth for all canvas elements  
- Canvas → Rendering layer based on objects  
- Socket.io → Real-time synchronization across users  
- Backend → API handling and AI processing  

---

## Key Highlights

- Templates behave exactly like user-created objects  
- Real-time synchronization of all actions (add, update, delete)  
- AI-generated diagrams are fully editable  
- Consistent rendering using centralized object model  
- Scalable and modular architecture  

---

## Additional Features

- User authentication system  
- Session-based collaboration  
- Clean and responsive UI design  

---

## Contributors

- Vinayak Chinchakhandi 
- Soham Sutar
- Swayam Nagavi
- Chinmayi Chodankar  

---

## License

This project is developed for academic and demonstration purposes.
