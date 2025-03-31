import React, { useState } from 'react';

interface AddFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddField: (field: { label: string; type: string }) => void;
}

const AddFieldModal: React.FC<AddFieldModalProps> = ({ isOpen, onClose, onAddField }) => {
  const [label, setLabel] = useState('');
  const [type, setType] = useState('text');

  const handleSubmit = () => {
    onAddField({ label, type });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>Add Field</h2>
        <label>
          Label:
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <label>
          Type:
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="checkbox">Checkbox</option>
          </select>
        </label>
        <button onClick={handleSubmit}>Add Field</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
};

export default AddFieldModal;
