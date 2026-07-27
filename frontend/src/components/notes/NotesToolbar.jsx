import React, { useRef } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  ListTodo, 
  Code, 
  Image, 
  Link 
} from 'lucide-react';

export default function NotesToolbar({ onFormat }) {
  const fileInputRef = useRef(null);

  // Prevent default mouse-down behavior so we do not lose text selection in contentEditable
  const handleButtonMouseDown = (e, command, value = null) => {
    e.preventDefault();
    onFormat(command, value);
  };

  const handleLinkClick = (e) => {
    e.preventDefault();
    const url = prompt('Enter link URL (e.g. https://google.com):');
    if (url) {
      // Simple validation prefix
      const targetUrl = url.match(/^https?:\/\//i) ? url : `https://${url}`;
      onFormat('createLink', targetUrl);
    }
  };

  const handleImageClick = (e) => {
    e.preventDefault();
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onFormat('insertImage', event.target.result);
      };
      reader.readAsDataURL(file);
    }
    // Reset file input value so same file can be selected again
    e.target.value = '';
  };

  return (
    <div className="notes-toolbar-container">
      <button 
        className="notes-toolbar-btn toolbar-active" 
        onMouseDown={(e) => handleButtonMouseDown(e, 'bold')}
        title="Bold"
      >
        <Bold size={16} />
      </button>
      <button 
        className="notes-toolbar-btn toolbar-active" 
        onMouseDown={(e) => handleButtonMouseDown(e, 'italic')}
        title="Italic"
      >
        <Italic size={16} />
      </button>
      <button 
        className="notes-toolbar-btn toolbar-active" 
        onMouseDown={(e) => handleButtonMouseDown(e, 'underline')}
        title="Underline"
      >
        <Underline size={16} />
      </button>
      
      <div className="notes-toolbar-divider" />
      
      <button 
        className="notes-toolbar-btn toolbar-active" 
        onMouseDown={(e) => handleButtonMouseDown(e, 'insertUnorderedList')}
        title="Bullet List"
      >
        <ListTodo size={16} />
      </button>
      <button 
        className="notes-toolbar-btn toolbar-active" 
        onMouseDown={(e) => handleButtonMouseDown(e, 'formatBlock', 'pre')}
        title="Code Block"
      >
        <Code size={16} />
      </button>
      <button 
        className="notes-toolbar-btn toolbar-active" 
        onMouseDown={handleImageClick}
        title="Insert Image"
      >
        <Image size={16} />
      </button>
      <button 
        className="notes-toolbar-btn toolbar-active" 
        onMouseDown={handleLinkClick}
        title="Insert Link"
      >
        <Link size={16} />
      </button>

      {/* Hidden file input for image uploads */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*" 
        onChange={handleImageFileChange} 
        style={{ display: 'none' }} 
      />
    </div>
  );
}
