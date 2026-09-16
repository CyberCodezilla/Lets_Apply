import type { NotifyMatchPayload } from '@/src/types';

export default defineBackground(() => {
  const notificationUrls = new Map<string, string>();

  // Open side panel when the extension action (toolbar icon) is clicked
  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      try {
        await chrome.sidePanel.open({ tabId: tab.id });
      } catch (err) {
        console.error('Failed to open side panel:', err);
      }
    }
  });

  // Set side panel behavior — open on action click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

  // On first install, open the options page for profile setup
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      chrome.runtime.openOptionsPage();
    }
  });

  // Handle Chrome notifications click — open the internship tab and side panel
  chrome.notifications.onClicked.addListener(async (notifId) => {
    const url = notificationUrls.get(notifId);
    if (url) {
      try {
        const tab = await chrome.tabs.create({ url });
        if (tab.id) {
          await chrome.sidePanel.open({ tabId: tab.id }).catch(console.error);
        }
      } catch (err) {
        console.error('Failed to open notification tab:', err);
      }
    }
  });

  // Relay messages between content script and side panel / background
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'OPEN_OPTIONS') {
      chrome.runtime.openOptionsPage();
      sendResponse({ success: true });
      return false;
    }

    if (message.type === 'NOTIFY_MATCH') {
      const payload = message.payload as NotifyMatchPayload;
      if (payload && payload.url) {
        const notifId = `match_${payload.jobId || Date.now()}`;
        notificationUrls.set(notifId, payload.url);

        const iconUrl = chrome.runtime.getURL('icon/128.png');
        const reason = payload.rationale?.[0] ? `\n💡 ${payload.rationale[0]}` : '';

        chrome.notifications.create(
          notifId,
          {
            type: 'basic',
            iconUrl,
            title: `🎯 ${payload.matchScore}% Match: ${payload.title}`,
            message: `${payload.company} • ${payload.location || 'Remote'} • ${payload.stipend || 'Stipend available'}${reason}`,
            priority: 2,
          },
          () => {
            sendResponse({ success: true, notifId });
          }
        );
        return true; // async sendResponse
      }
    }

    return false;
  });
});
