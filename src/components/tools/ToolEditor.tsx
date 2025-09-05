import React from 'react';
import { useParams } from 'react-router-dom';

const ToolEditor: React.FC = () => {
  const { toolId } = useParams<{ toolId: string }>();

  return (
    <div className="tool-editor fade-in">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Edit Tool</h2>
          <p className="text-sm text-gray-500">
            Modify your voice interaction tool configuration
          </p>
        </div>
        <div className="card-body">
          <div className="text-center p-6">
            <div className="mb-4">
              <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} 
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Tool Editor Coming Soon
            </h3>
            <p className="text-gray-600">
              Edit tool: {toolId}
            </p>
            <p className="text-gray-600">
              This feature will allow you to modify existing voice interaction tools.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolEditor;
