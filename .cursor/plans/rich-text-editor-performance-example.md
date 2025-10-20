# RichTextEditor Performance Optimization with useEditorState

## ✅ What We Did

Properly implemented `useEditorState` hook to improve performance by accessing editor state without causing unnecessary re-renders.

## 🎯 Key Performance Principles

### ✅ GOOD: Primitive/Stable Values in Selector
```typescript
const editorState = useEditorState({
  editor,
  selector: ({ editor }) => {
    if (!editor) return null;
    
    // ✅ These are GOOD - primitive values that only change when needed
    const text = editor.state.doc.textContent;
    return {
      isEditable: editor.isEditable,        // boolean
      isEmpty: editor.isEmpty,              // boolean
      isFocused: editor.isFocused,          // boolean
      characterCount: text.length,          // number
      wordCount: text.split(/\s+/).length,  // number
      isBold: editor.isActive('bold'),      // boolean
    };
  },
});
```

### ❌ BAD: Object/String References in Selector
```typescript
const editorState = useEditorState({
  editor,
  selector: ({ editor }) => {
    if (!editor) return null;
    
    // ❌ These are BAD - create new references on EVERY transaction!
    return {
      content: editor.getJSON(),      // ❌ New object every time
      contentString: editor.getText(), // ❌ New string every time
      contentHtml: editor.getHTML(),   // ❌ New string every time
      selection: editor.state.selection, // ❌ New object every time
    };
  },
});
// This defeats the purpose - causes re-render on EVERY keystroke!
```

## 💡 Why This Matters

### Without useEditorState (or with bad usage):
- Component re-renders on **every** editor transaction
- Every keystroke triggers re-render
- Poor performance with large documents

### With useEditorState (proper usage):
- Component only re-renders when **selected state** changes
- Typing "hello" won't re-render until character count changes
- Much better performance

## 🚀 Usage Example

```tsx
// Enable status bar to see character/word count
<RichTextEditor
  content={content}
  onChange={setContent}
  showStatus={true}  // 👈 This uses editorState efficiently!
/>
```

The status bar displays:
- Character count
- Word count  
- Empty indicator

And it does this **without** causing re-renders on every keystroke because:
1. We extract primitive numbers from the editor state
2. React only re-renders when these numbers actually change
3. The main editor component has `shouldRerenderOnTransaction: false`

## 📊 Performance Impact

```
Before (with bad editorState usage):
  - Type "hello" → 5 re-renders ❌
  
After (with proper editorState usage):  
  - Type "hello" → 1-2 re-renders ✅
  (only when character/word count changes)
```

## 🎓 When to Use useEditorState

Use it when you need to:
- ✅ Display editor statistics (character count, word count)
- ✅ Conditionally render UI based on editor state (isEmpty, isFocused)
- ✅ Show active formatting states (isBold, isItalic)
- ✅ Enable/disable buttons based on editor capabilities

Don't use it for:
- ❌ Getting content for onChange callbacks (use onUpdate event instead)
- ❌ Accessing full document content frequently
- ❌ Any values that create new object references

## 🔧 Already Optimized

This component already has these optimizations:
1. `shouldRerenderOnTransaction: false` - prevents re-renders on every transaction
2. `immediatelyRender: false` - prevents SSR issues and initial render cost
3. Debounced onChange (300ms) - reduces callback frequency
4. Proper useEditorState with primitive values only

