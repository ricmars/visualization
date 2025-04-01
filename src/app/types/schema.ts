export const workflowSchema = {
  type: 'object',
  properties: {
    fields: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'label', 'type'],
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          type: { 
            type: 'string',
            enum: ['text', 'select', 'checkbox', 'email', 'textarea', 'number']
          },
          options: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    },
    stages: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'status', 'steps'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          status: { 
            type: 'string',
            enum: ['pending', 'active', 'completed']
          },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'name', 'status', 'fields'],
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                fields: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['id', 'value'],
                    properties: {
                      id: { type: 'string' }
                    }
                  }
                }
              }
            }
          },
          isNew: { type: 'boolean' },
          isMoving: { type: 'boolean' },
          isDeleting: { type: 'boolean' },
          moveDirection: {
            type: 'string',
            enum: ['up', 'down']
          }
        }
      }
    }
  }
}; 