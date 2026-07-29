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
  const savedRangeRef = useRef(null);

  // Prevent default mouse-down behavior so we do not lose text selection in contentEditable
  const handleButtonMouseDown = (e, command, value = null) => {
    e.preventDefault();
    onFormat(command, value);
  };

  const handleLinkMouseDown = (e) => {
    e.preventDefault(); // Prevent focus loss from editor
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange();
    }
  };

  const handleLinkClick = (e) => {
    e.preventDefault();
    
    let existingUrl = '';
    const selection = window.getSelection();
    
    // Inspect if selection was nested inside an anchor tag
    let node = selection ? selection.anchorNode : null;
    while (node && node.nodeName !== 'A' && (!node.className || !node.className.includes('notes-body-editable'))) {
      node = node.parentNode;
    }
    if (node && node.nodeName === 'A') {
      existingUrl = node.getAttribute('href') || '';
    }
    
    const url = prompt('Enter link URL (leave empty to remove link):', existingUrl);
    
    // Restore selection range
    if (savedRangeRef.current && selection) {
      selection.removeAllRanges();
      selection.addRange(savedRangeRef.current);
    }
    
    // Apply link or unlink command
    if (url === '') {
      onFormat('unlink');
    } else if (url !== null) {
      const targetUrl = url.match(/^https?:\/\//i) ? url : `https://${url}`;
      
      const range = savedRangeRef.current;
      if (range && range.collapsed) {
        // If selection is collapsed (no highlighted text), insert visible anchor tag with link text
        const anchor = document.createElement('a');
        anchor.href = targetUrl;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.textContent = url;
        
        range.insertNode(anchor);
        
        // Move cursor to after the new anchor tag
        const newRange = document.createRange();
        newRange.setStartAfter(anchor);
        newRange.setEndAfter(anchor);
        selection.removeAllRanges();
        selection.addRange(newRange);
        
        onFormat('insertHTML', ''); // Trigger state update
      } else {
        onFormat('createLink', targetUrl);
      }
    }
    
    // Clear saved range
    savedRangeRef.current = null;
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
        onMouseDown={handleLinkMouseDown}
        onClick={handleLinkClick}
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
