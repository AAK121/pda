import React, { useState } from 'react';
import './MailerPandaUI.css';
import { useAuth } from '../contexts/AuthContext';
import { hushMcpApi } from '../services/hushMcpApi';

// Interface definitions for backend integration
interface GeneratedEmail {
  subject: string;
  content: string;
}

interface CampaignResponse {
  campaign_id?: string;
  status: string;
  email_template?: {
    subject: string;
    body: string;
  };
  recipient_count?: number;
  approval_status?: string;
  requires_approval?: boolean;
  errors?: string[];
  message?: string;
  processing_time?: number;
  emails_sent?: number;
  recipients_processed?: number;
}

interface MailerPandaUIProps {
  onBack?: () => void;
}

// --- Main MailerPanda UI Component ---
function MailerPandaUI({ onBack }: MailerPandaUIProps) {
  // Auth context for user information and token generation
  const { user } = useAuth();
  
  // State to manage the overall flow of the UI
  // 'INITIAL' -> 'DRAFT_REVIEW' -> 'SUGGESTING_CHANGES' OR 'FINAL_CONFIRMATION' -> 'SENT'
  const [uiState, setUiState] = useState('INITIAL');
  
  // State for user inputs
  const [userInput, setUserInput] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [suggestion, setSuggestion] = useState('');
  const [useContextPersonalization, setUseContextPersonalization] = useState(false);

  // State to hold the response from the backend
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail>({ subject: '', content: '' });
  const [campaignId, setCampaignId] = useState<string>('');

  // State for loading indicators
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // --- Handlers for User Actions ---

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setExcelFile(file);
    }
  };

  // Convert file to base64 for backend
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleGenerateClick = async () => {
    if (!userInput) {
      alert('Please enter a command for the mailing agent.');
      return;
    }

    if (!user?.id) {
      alert('User not authenticated. Please log in.');
      return;
    }

    console.log("Sending to backend:", { command: userInput, file: excelFile?.name });
    setIsLoading(true);
    setError(''); // Clear any previous errors

    try {
      let excelFileData = '';
      if (excelFile) {
        excelFileData = await fileToBase64(excelFile);
      }

      // Generate fresh consent tokens using the same pattern as AIAgentChat
      console.log("Generating fresh consent tokens for user:", user.id);
      let consentTokens;
      try {
        consentTokens = await hushMcpApi.createMailerPandaTokens(user.id);
        console.log("Generated consent tokens:", consentTokens);
      } catch (tokenError) {
        console.error("Failed to generate consent tokens:", tokenError);
        setError('Failed to generate authentication tokens. Please try again.');
        setIsLoading(false);
        return;
      }

      // Prepare request for our MailerPanda backend
      const requestBody = {
        user_id: user.id, // Use actual user ID from auth
        user_input: userInput,
        excel_file_data: excelFileData,
        excel_file_name: excelFile?.name || '',
        mode: 'interactive', // Must be one of: 'interactive', 'headless'
        use_context_personalization: useContextPersonalization, // NEW: Context personalization toggle
        personalization_mode: 'aggressive', // or 'conservative'
        // Add API keys for email sending
        google_api_key: 'AIzaSyCYmItUaAVeo1pRFnBdFPqTibIqas17TBI',
        mailjet_api_key: 'cca56ed08f5272f813370d7fc5a34a24',
        mailjet_api_secret: '60fb43675233e2ac775f1c6cb8fe455c',
        consent_tokens: consentTokens // Use freshly generated tokens
      };

      console.log("Request body:", requestBody);

      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

      try {
        const response = await fetch('http://127.0.0.1:8001/agents/mailerpanda/mass-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId); // Clear timeout if request succeeds

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Backend error:', errorText);
          throw new Error(`Backend error: ${response.status} - ${errorText}`);
        }

        const data: CampaignResponse = await response.json();
        console.log("Backend response:", data);

      // Check if we got a proper response with email template
      if (data.email_template && (data.status === 'complete' || data.status === 'awaiting_approval' || data.status === 'completed')) {
        // Set the generated email content
        setGeneratedEmail({
          subject: data.email_template.subject || 'Generated Email',
          content: data.email_template.body || 'No content generated'
        });
        
        setCampaignId(data.campaign_id || '');
        setUiState('DRAFT_REVIEW'); // Move to review stage
        
        console.log("Email template extracted:", data.email_template);
      } else if (data.status === 'error') {
        // Handle different types of errors
        let errorMessage = 'Unknown error occurred';
        
        if (data.errors && data.errors.length > 0) {
          errorMessage = data.errors.join(', ');
        } else if (data.message) {
          errorMessage = data.message;
        }
        
        // Check for quota errors specifically
        if (errorMessage.includes('exceeded your current quota') || errorMessage.includes('429')) {
          errorMessage = 'Google AI quota exceeded. Please wait a few minutes and try again, or consider upgrading your Google AI plan.';
        }
        
        throw new Error(errorMessage);
      } else {
        throw new Error(`Unexpected response: ${data.status} - ${JSON.stringify(data)}`);
      }
      
      } catch (fetchError) {
        clearTimeout(timeoutId); // Clear timeout on error
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Request timed out. The AI generation is taking longer than expected. Please try again.');
        }
        throw fetchError; // Re-throw other fetch errors
      }
      
    } catch (error) {
      console.error('Error calling backend:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Error generating email: ${errorMessage}`);
      setUiState('INITIAL'); // Return to initial state on error
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleApprove = () => {
    setUiState('FINAL_CONFIRMATION');
  };

  const handleSuggestChanges = () => {
    setUiState('SUGGESTING_CHANGES');
  };

  const handleSubmitSuggestion = async () => {
    if (!suggestion) {
        alert('Please enter your suggestions.');
        return;
    }
    
    console.log("Sending suggestions to backend:", suggestion);
    setIsLoading(true);

    try {
      // Send approval request with modification feedback
      const approvalRequest = {
        user_id: user?.id || 'frontend_user_123', // Use actual user ID from auth
        campaign_id: campaignId,
        action: 'modify',
        feedback: suggestion
      };

      const response = await fetch('http://127.0.0.1:8001/agents/mailerpanda/mass-email/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(approvalRequest)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("Modification response:", data);

      // Check if we got a new email template
      if (data.email_template && (data.status === 'awaiting_approval' || data.status === 'complete')) {
        // Update the generated email content with the modified version
        setGeneratedEmail({
          subject: data.email_template.subject || 'Modified Email',
          content: data.email_template.body || 'No content generated'
        });
        
        // Update campaign ID if it changed
        if (data.campaign_id) {
          setCampaignId(data.campaign_id);
        }
        
        // Clear the suggestion and go back to review state
        setSuggestion('');
        setUiState('DRAFT_REVIEW');
        
        console.log("Modified email template received:", data.email_template);
      } else {
        throw new Error(`Modification failed: ${data.status}`);
      }
      
    } catch (error) {
      console.error('Error submitting suggestions:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Error submitting suggestions: ${errorMessage}`);
      setUiState('SUGGESTING_CHANGES'); // Stay in the suggestion state to allow retry
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalSend = async () => {
    console.log("Final approval received! Sending emails now.");
    setIsLoading(true);

    try {
      // Send final approval to backend
      const approvalRequest = {
        user_id: user?.id || 'frontend_user_123', // Use actual user ID from auth
        campaign_id: campaignId,
        action: 'approve'
      };

      const response = await fetch('http://127.0.0.1:8001/agents/mailerpanda/mass-email/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(approvalRequest)
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const data = await response.json();
      console.log("Final approval response:", data);

      setUiState('SENT');
      
    } catch (error) {
      console.error('Error sending final approval:', error);
      alert('Error sending emails. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSend = () => {
    setUiState('DRAFT_REVIEW'); // Go back to the review screen
  };

  const handleReset = () => {
    setUiState('INITIAL');
    setUserInput('');
    setExcelFile(null);
    setSuggestion('');
    setGeneratedEmail({ subject: '', content: '' });
    setCampaignId('');
  };

  // --- Render Functions for each UI State ---

  const renderInitialState = () => (
    <div className="card">
      <h2>MailerPanda Assistant</h2>
      <p>Upload a contact sheet (optional) and tell me what to do.</p>
      
      <div className="file-input-wrapper">
        <button className="btn-file">
          {excelFile ? `✔️ ${excelFile.name}` : 'Upload Excel Sheet'}
        </button>
        <input 
          type="file" 
          accept=".xlsx, .xls, .csv"
          onChange={handleFileChange} 
        />
      </div>

      <div className="checkbox-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={useContextPersonalization}
            onChange={(e) => setUseContextPersonalization(e.target.checked)}
          />
          <span className="checkmark"></span>
          Use context personalization from description column in Excel sheet
        </label>
      </div>

      <div className="input-group">
        <input
          type="text"
          className="main-input"
          placeholder="e.g., 'Draft an email to clients about our new pricing...'"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleGenerateClick()}
        />
        <button onClick={handleGenerateClick} disabled={isLoading}>
          {isLoading ? 'Generating...' : '➤'}
        </button>
      </div>

      {onBack && (
        <button className="btn-back" onClick={onBack}>
          ← Back to Agents
        </button>
      )}
    </div>
  );

  const renderDraftReviewState = () => (
    <div className="card">
      <h2>Review Generated Draft</h2>
      <div className="email-display">
        <p><strong>Subject:</strong> {generatedEmail.subject}</p>
        <div className="email-content">
          <p>{generatedEmail.content}</p>
        </div>
      </div>
      <div className="button-group">
        <button className="btn-approve" onClick={handleApprove}>Approve Content</button>
        <button className="btn-suggest" onClick={handleSuggestChanges}>Suggest Changes</button>
      </div>
    </div>
  );

  const renderSuggestChangesState = () => (
    <div className="card">
        <h2>Suggest Changes</h2>
        <p>Your suggestions will be used to generate a new draft.</p>
        <textarea
            className="suggestion-box"
            placeholder="e.g., 'Make the tone more casual', 'Mention the 20% discount for early birds...'"
            value={suggestion}
            onChange={(e) => setSuggestion(e.target.value)}
        />
        <div className="button-group">
            <button onClick={handleSubmitSuggestion} disabled={isLoading}>
              {isLoading ? 'Submitting...' : 'Submit Suggestions'}
            </button>
            <button className="btn-secondary" onClick={() => setUiState('DRAFT_REVIEW')}>Back to Review</button>
        </div>
    </div>
  );

  const renderFinalConfirmationState = () => (
    <div className="card confirmation-card">
      <h2>Final Confirmation</h2>
      <p>Are you sure you want to send this email to all contacts in the provided list?</p>
      <div className="button-group">
        <button className="btn-danger" onClick={handleFinalSend} disabled={isLoading}>
          {isLoading ? 'Sending...' : 'Yes, Send Mail'}
        </button>
        <button className="btn-secondary" onClick={handleCancelSend}>No, Go Back</button>
      </div>
    </div>
  );

  const renderSentState = () => (
    <div className="card">
        <h2>✅ Success!</h2>
        <p>The emails have been queued for sending.</p>
        <button onClick={handleReset}>Start a New Task</button>
    </div>
  );

  // --- Main Render Logic ---
  const renderCurrentState = () => {
    // Show error message if there's an error
    if (error) {
      return (
        <div className="card">
          <h2>❌ Error</h2>
          <div className="error-message" style={{ 
            backgroundColor: '#fee', 
            border: '1px solid #fcc', 
            padding: '10px', 
            borderRadius: '5px',
            marginBottom: '20px',
            color: '#900'
          }}>
            {error}
          </div>
          <button 
            className="btn-primary" 
            onClick={() => setError('')}
          >
            Try Again
          </button>
          <button 
            className="btn-secondary" 
            onClick={handleReset}
            style={{ marginLeft: '10px' }}
          >
            Reset
          </button>
        </div>
      );
    }

    if (isLoading && (uiState === 'FINAL_CONFIRMATION' || uiState === 'SENT')) {
      return (
        <div className="card">
          <h2>Sending Emails...</h2>
          <p>This may take a moment.</p>
        </div>
      );
    }

    switch (uiState) {
      case 'DRAFT_REVIEW':
        return renderDraftReviewState();
      case 'SUGGESTING_CHANGES':
        return renderSuggestChangesState();
      case 'FINAL_CONFIRMATION':
        return renderFinalConfirmationState();
      case 'SENT':
        return renderSentState();
      case 'INITIAL':
      default:
        return renderInitialState();
    }
  };

  return (
    <div className="app-container">
      {renderCurrentState()}
    </div>
  );
}

export default MailerPandaUI;
