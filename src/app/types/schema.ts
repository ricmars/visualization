export const workflowSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
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
          },
          required: { type: 'boolean', default: false },
          isPrimary: { type: 'boolean', default: false },
          value: {
            type: ['string', 'number', 'boolean', 'null'],
            description: "The current value of the field"
          }
        }
      }
    },
    stages: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'steps'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'name', 'type', 'fields'],
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                type: { type: 'string' },
                fields: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['id'],
                    properties: {
                      id: { type: 'string' }
                    }
                  }
                }
              }
            }
          },
          isNew: { type: 'boolean', default: false },
          isMoving: { type: 'boolean', default: false },
          isDeleting: { type: 'boolean', default: false },
          moveDirection: {
            type: 'string',
            enum: ['up', 'down']
          }
        }
      }
    },
    messages: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'type', 'content', 'sender'],
        properties: {
          id: { type: 'string' },
          type: { 
            type: 'string',
            enum: ['text', 'json']
          },
          content: {
            oneOf: [
              { type: 'string' },
              {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  model: { type: 'object' },
                  action: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['add', 'delete', 'move', 'update']
                      },
                      changes: {
                        type: 'array',
                        items: {
                          type: 'object',
                          required: ['type', 'path', 'target'],
                          properties: {
                            type: {
                              type: 'string',
                              enum: ['add', 'delete', 'move', 'update']
                            },
                            path: { type: 'string' },
                            value: { type: 'object' },
                            oldValue: { type: 'object' },
                            target: {
                              type: 'object',
                              required: ['type'],
                              properties: {
                                type: {
                                  type: 'string',
                                  enum: ['stage', 'step']
                                },
                                id: { type: 'string' },
                                name: { type: 'string' },
                                sourceStageId: { type: 'string' },
                                targetStageId: { type: 'string' },
                                sourceIndex: { type: 'integer' },
                                targetIndex: { type: 'integer' }
                              }
                            }
                          }
                        }
                      }
                    }
                  },
                  visualization: {
                    type: 'object',
                    properties: {
                      totalStages: { type: 'integer' },
                      stageBreakdown: {
                        type: 'array',
                        items: {
                          type: 'object',
                          required: ['name', 'stepCount'],
                          properties: {
                            name: { type: 'string' },
                            stepCount: { type: 'integer' },
                            steps: {
                              type: 'array',
                              items: {
                                type: 'object',
                                required: ['name'],
                                properties: {
                                  name: { type: 'string' }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            ]
          },
          sender: {
            type: 'string',
            enum: ['user', 'ai']
          }
        }
      }
    }
  }
}; 