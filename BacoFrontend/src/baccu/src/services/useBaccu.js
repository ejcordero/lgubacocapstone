import { ref } from 'vue';
import { sendMessage, BACCU_ERROR_TYPES } from './geminiService';

export function useBaccu() {
  const messages = ref([
    {
      role: 'model',
      text: "Mabuhay! I'm BACCU, your official Baco Municipality AI Assistant.\n\nI can help you with:\n• Municipal services & government info\n• Tourist attractions & local spots\n• Community events & history\n\nHow may I assist you today?"
    }
  ]);

  const isLoading = ref(false);
  const showKeyButton = ref(false);

  const sendUserMessage = async (text) => {
    if (!text.trim() || isLoading.value) return;

    // Snapshot history BEFORE pushing the new user message
    const historySnapshot = messages.value
      .filter(m => !m.isError)
      .map(m => ({ role: m.role, text: m.text }));

    messages.value.push({ role: 'user', text: text.trim() });
    isLoading.value = true;

    try {
      const responseText = await sendMessage(text.trim(), historySnapshot);
      if (responseText) {
        messages.value.push({ role: 'model', text: responseText });
      }
    } catch (error) {
      console.error("Chat error:", error);
      
      let errorText = "I apologize, but I encountered an error. Please try again later.";
      let showKey = false;

      switch (error.message) {
        case BACCU_ERROR_TYPES.QUOTA_EXCEEDED:
          errorText = "I've reached the free tier usage limit (Quota Exceeded).";
          showKey = true;
          break;
        case BACCU_ERROR_TYPES.MISSING_API_KEY:
        case BACCU_ERROR_TYPES.INVALID_API_KEY:
          errorText = "I need a valid Gemini API key to function.";
          showKey = true;
          break;
        case BACCU_ERROR_TYPES.NETWORK_ERROR:
          errorText = "I'm having trouble connecting to the internet.";
          break;
        case BACCU_ERROR_TYPES.SAFETY_BLOCK:
          errorText = "I cannot fulfill this request due to safety guidelines.";
          break;
        case BACCU_ERROR_TYPES.SERVICE_ERROR:
          errorText = "I'm experiencing a temporary service disruption.";
          showKey = true;
          break;
      }

      showKeyButton.value = showKey;
      
      messages.value.push({
        role: 'model',
        text: showKey 
          ? `${errorText} Please select a paid Gemini API key to continue.`
          : errorText,
        isError: true
      });
    } finally {
      isLoading.value = false;
    }
  };

  const addModelMessage = (text) => {
    messages.value.push({ role: 'model', text });
  };

  return {
    messages,
    isLoading,
    showKeyButton,
    sendUserMessage,
    addModelMessage
  };
}
