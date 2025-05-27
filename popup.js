// popup.js
document.addEventListener('DOMContentLoaded', () => {
    const globalOptionIDs = ['opt1', 'opt2', 'opt_seF_nseB', 'opt_seB_nseF'];
    const messageModal = document.getElementById('messageModal');
    const messageText = document.getElementById('messageText');
    const closeMessageBtn = document.getElementById('closeMessageBtn');
    const sitePreferencesModal = document.getElementById('sitePreferencesModal');
    
    const siteStatusTextOutput = document.getElementById('siteStatusTextOutput'); 
    const removeSiteBtn = document.getElementById('removeSiteBtn'); 

    const addSiteBackgroundBtn = document.getElementById('addSiteBackground');
    const addSiteForegroundBtn = document.getElementById('addSiteForeground');
    const sitePreferencesBtn = document.getElementById('sitePreferencesBtn');
    const closeSitePreferencesBtn = document.getElementById('closeSitePreferences');
    const clearAllSitesBtn = document.getElementById('clearAllSites');

    function showMessage(msg) {
        messageText.textContent = msg;
        messageModal.style.display = 'flex';
    }

    function hideMessage() {
        messageModal.style.display = 'none';
    }

    closeMessageBtn.addEventListener('click', hideMessage);

    function showSitePreferencesModal() {
        sitePreferencesModal.style.display = 'flex';
        loadSitePreferences();
    }

    function hideSitePreferencesModal() {
        sitePreferencesModal.style.display = 'none';
    }

    function loadSitePreferences() {
        chrome.storage.sync.get(['sitePreferences'], (data) => {
            const sitePrefs = data.sitePreferences || {};
            const foregroundSites = document.getElementById('foregroundSites');
            const backgroundSites = document.getElementById('backgroundSites');
            
            foregroundSites.innerHTML = '';
            backgroundSites.innerHTML = '';
            
            const foregroundList = [];
            const backgroundList = [];
            
            Object.entries(sitePrefs).forEach(([site, behavior]) => {
                if (behavior === 'foreground') {
                    foregroundList.push(site);
                } else if (behavior === 'background') {
                    backgroundList.push(site);
                }
            });
            
            if (foregroundList.length === 0) {
                foregroundSites.innerHTML = '<p class="text-gray-500 text-sm">No sites added for foreground behavior</p>';
            } else {
                foregroundList.forEach(site => {
                    const siteItem = document.createElement('div');
                    siteItem.className = 'site-item';
                    siteItem.innerHTML = `<span>${site}</span><button>Remove</button>`;
                    siteItem.querySelector('button').addEventListener('click', () => removeSitePreference(site));
                    foregroundSites.appendChild(siteItem);
                });
            }
            
            if (backgroundList.length === 0) {
                backgroundSites.innerHTML = '<p class="text-gray-500 text-sm">No sites added for background behavior</p>';
            } else {
                backgroundList.forEach(site => {
                    const siteItem = document.createElement('div');
                    siteItem.className = 'site-item';
                    siteItem.innerHTML = `<span>${site}</span><button>Remove</button>`;
                    siteItem.querySelector('button').addEventListener('click', () => removeSitePreference(site));
                    backgroundSites.appendChild(siteItem);
                });
            }
        });
    }

    function removeSitePreference(site) {
        chrome.storage.sync.get(['sitePreferences'], (data) => {
            const sitePrefs = data.sitePreferences || {};
            delete sitePrefs[site];
            
            chrome.storage.sync.set({ sitePreferences: sitePrefs }, () => {
                if (chrome.runtime.lastError) {
                    showMessage('Error removing site preference.');
                } else {
                    showMessage(`Removed preference for ${site}`);
                    loadSitePreferences();
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs[0].url) {
                            try {
                                const currentHostname = new URL(tabs[0].url).hostname;
                                if (currentHostname === site) {
                                    location.reload();
                                }
                            } catch (e) { /* ignore invalid URL */ }
                        }
                    });
                }
            });
        });
    }

    sitePreferencesBtn.addEventListener('click', showSitePreferencesModal);
    closeSitePreferencesBtn.addEventListener('click', hideSitePreferencesModal);
    
    clearAllSitesBtn.addEventListener('click', () => {
        chrome.storage.sync.set({ sitePreferences: {} }, () => {
            if (chrome.runtime.lastError) {
                showMessage('Error clearing all site preferences.');
            } else {
                showMessage('All site preferences cleared!');
                loadSitePreferences();
                location.reload();
            }
        });
    });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        let hostname = '';
        let isSearchEngine = false;
        
        if (tabs[0].url && tabs[0].url.match(/^https?:\/\//)) {
            try {
                const currentUrl = new URL(tabs[0].url);
                hostname = currentUrl.hostname;
                const domain = currentUrl.href;
                isSearchEngine = domain.includes("google.com") || domain.includes("search.brave.com") || domain.includes("duckduckgo.com");
            } catch (e) {
                console.error("Pro DoubleClick: Invalid URL for hostname extraction", tabs[0].url, e);
                hostname = ''; 
            }
        }
        
        chrome.storage.sync.get(['linkPreferences', 'sitePreferences', 'customDomains'], (data) => {
            let prefs = data.linkPreferences;
            
            let noActiveGlobalPreference = true;
            if (prefs && typeof prefs === 'object' && Object.keys(prefs).length > 0) {
                if (globalOptionIDs.some(optId => prefs[optId] === true)) {
                    noActiveGlobalPreference = false;
                }
            }

            if (noActiveGlobalPreference) {
                prefs = {}; 
                globalOptionIDs.forEach(optId => {
                    prefs[optId] = (optId === 'opt_seB_nseF'); // UI defaults to opt_seB_nseF
                });
                console.log('Pro DoubleClick: No active global preference found, applying UI default (opt_seB_nseF):', JSON.stringify(prefs));
            } else {
                const loadedPrefsCopy = { ...prefs }; 
                prefs = {}; 
                globalOptionIDs.forEach(optId => {
                    prefs[optId] = loadedPrefsCopy[optId] === true; 
                });
                console.log('Pro DoubleClick: Loaded preferences from storage:', JSON.stringify(prefs));
            }

            const sitePrefs = data.sitePreferences || {};
            const customDomains = data.customDomains || {};

            updateSiteStatus(hostname, prefs, sitePrefs, customDomains, isSearchEngine);

            globalOptionIDs.forEach(id => { 
                const element = document.getElementById(id);
                if (element) {
                    element.checked = prefs[id] || false; 
                }
            });

            updateToggleStates(); 
            
            if (hostname && sitePrefs[hostname]) {
                if(removeSiteBtn) removeSiteBtn.style.display = 'inline-block'; 
            } else {
                if(removeSiteBtn) removeSiteBtn.style.display = 'none';
            }
        });

        function updateSiteStatus(hostname, prefs, sitePrefs, customDomains, isSearchEngine) {
            if (!siteStatusTextOutput) return;
            if (!hostname) {
                siteStatusTextOutput.textContent = 'No site-specific preference can be set for this page.';
                if(removeSiteBtn) removeSiteBtn.style.display = 'none'; 
                return;
            }

            let statusText = `Current site: ${hostname}`;
            let behavior = 'default'; 
            let globalPrefApplied = false; // Flag to check if a global preference text was set

            if (sitePrefs[hostname]) {
                behavior = sitePrefs[hostname];
                statusText += `\nSite-specific setting: Links will open in new ${behavior} tab.`;
            }
            else if (customDomains[hostname]) { // Not directly settable in popup, but check for completeness
                behavior = customDomains[hostname];
                statusText += `\nCustom domain setting: Links will open in new ${behavior} tab.`;
            }
            // Check global preferences if no site/custom preference applies
            else if (prefs.opt1) {
                behavior = 'foreground';
                statusText += `\nGlobal setting: All links open in new foreground tab.`;
                globalPrefApplied = true;
            }
            else if (prefs.opt2) {
                behavior = 'background';
                statusText += `\nGlobal setting: All links open in new background tab.`;
                globalPrefApplied = true;
            }
            else if (prefs.opt_seF_nseB) {
                behavior = isSearchEngine ? 'foreground' : 'background';
                statusText += `\nGlobal setting: Search engine links in ${isSearchEngine ? 'foreground' : 'background'}, others in ${!isSearchEngine ? 'background' : 'foreground'}.`;
                globalPrefApplied = true;
            }
            else if (prefs.opt_seB_nseF) { // MODIFIED: Specific static text for opt_seB_nseF
                // This text is fixed as per request, even if it doesn't match the option's actual behavior.
                statusText += `\nDefault Setting: Search engine links in background, others in foreground.`;
                globalPrefApplied = true;
            }
            else { // No site-specific, custom, or active global preference from storage
                   // This means the content script's true default behavior is active.
                behavior = isSearchEngine ? 'background' : 'foreground'; // Actual default: SE Background, Others Foreground
                statusText += `\nNo preference set. Default Setting: Search engine links in background, others in foreground.`;
            }
            siteStatusTextOutput.innerHTML = statusText.replace(/\n/g, '<br>');
        }


        function updateToggleStates() {
            const opt1 = document.getElementById('opt1');
            const opt2 = document.getElementById('opt2');
            const opt_seF_nseB = document.getElementById('opt_seF_nseB');
            const opt_seB_nseF = document.getElementById('opt_seB_nseF');

            if (!opt1 || !opt2 || !opt_seF_nseB || !opt_seB_nseF) return; 

            if (event && event.target && globalOptionIDs.includes(event.target.id)) {
                const changedToggle = event.target;
                if (changedToggle.checked) {
                    globalOptionIDs.forEach(id => {
                        if (id !== changedToggle.id) {
                            const el = document.getElementById(id);
                            if (el) el.checked = false;
                        }
                    });
                }
            }
            
            const opt1Checked = opt1.checked;
            const opt2Checked = opt2.checked;

            if (opt1Checked || opt2Checked) {
                opt_seF_nseB.disabled = true;
                opt_seB_nseF.disabled = true;
                if(opt_seF_nseB.disabled) opt_seF_nseB.checked = false; 
                if(opt_seB_nseF.disabled) opt_seB_nseF.checked = false;
            } else {
                opt_seF_nseB.disabled = false;
                opt_seB_nseF.disabled = false;
            }

            const currentPrefsForStatus = {};
            globalOptionIDs.forEach(id => {
                const element = document.getElementById(id);
                if (element) currentPrefsForStatus[id] = !element.disabled && element.checked;
            });
            
            chrome.storage.sync.get(['sitePreferences', 'customDomains'], (data) => { 
                const sitePrefs = data.sitePreferences || {};
                const customDomains = data.customDomains || {};
                updateSiteStatus(hostname, currentPrefsForStatus, sitePrefs, customDomains, isSearchEngine);

                if (removeSiteBtn) {
                    if (hostname && sitePrefs[hostname]) {
                        removeSiteBtn.style.display = 'inline-block';
                    } else {
                        removeSiteBtn.style.display = 'none';
                    }
                }
            });
        }

        globalOptionIDs.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.addEventListener('change', updateToggleStates);
        });
        
        addSiteBackgroundBtn.addEventListener('click', () => {
            if (!hostname) {
                showMessage('Cannot add site preference for this page (invalid URL or hostname).');
                return;
            }
            chrome.storage.sync.get(['sitePreferences'], (data) => {
                const sitePrefs = data.sitePreferences || {};
                sitePrefs[hostname] = 'background';
                chrome.storage.sync.set({ sitePreferences: sitePrefs }, () => {
                    if (chrome.runtime.lastError) showMessage('Error saving site preference.');
                    else {
                        showMessage(`Added ${hostname} to background sites!`);
                        setTimeout(() => location.reload(), 1000);
                    }
                });
            });
        });
        
        addSiteForegroundBtn.addEventListener('click', () => {
            if (!hostname) {
                showMessage('Cannot add site preference for this page (invalid URL or hostname).');
                return;
            }
            chrome.storage.sync.get(['sitePreferences'], (data) => {
                const sitePrefs = data.sitePreferences || {};
                sitePrefs[hostname] = 'foreground';
                chrome.storage.sync.set({ sitePreferences: sitePrefs }, () => {
                    if (chrome.runtime.lastError) showMessage('Error saving site preference.');
                    else {
                        showMessage(`Added ${hostname} to foreground sites!`);
                        setTimeout(() => location.reload(), 1000);
                    }
                });
            });
        });
        
        if (removeSiteBtn) {
            removeSiteBtn.addEventListener('click', () => {
                if (!hostname) {
                    showMessage('No site to remove (invalid URL or hostname).');
                    return;
                }
                chrome.storage.sync.get(['sitePreferences'], (data) => {
                    const sitePrefs = data.sitePreferences || {};
                    delete sitePrefs[hostname];
                    chrome.storage.sync.set({ sitePreferences: sitePrefs }, () => {
                        if (chrome.runtime.lastError) showMessage('Error removing site preference.');
                        else {
                            showMessage(`Removed preference for ${hostname}`);
                            setTimeout(() => location.reload(), 1000);
                        }
                    });
                });
            });
        }

        document.getElementById('saveBtn').addEventListener('click', () => {
            const prefsToSave = {};
            let isAnyGlobalOptionChecked = false; 
            globalOptionIDs.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    prefsToSave[id] = !element.disabled && element.checked;
                    if (prefsToSave[id]) {
                        isAnyGlobalOptionChecked = true;
                    }
                }
            });

            console.log('Pro DoubleClick: Saving preferences:', { linkPreferences: prefsToSave });

            if (!isAnyGlobalOptionChecked) {
                // MODIFIED: Simplified message when no global option is selected
                showMessage('No Preference set');
                chrome.storage.sync.set({ linkPreferences: prefsToSave }, (result) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error saving preferences (no preference state):', chrome.runtime.lastError.message);
                         if (messageModal.style.display === 'none' || messageText.textContent !== 'No Preference set') {
                            showMessage('Error saving preferences.');
                        }
                    } else {
                        setTimeout(() => location.reload(), 2500); 
                    }
                });
            } else {
                chrome.storage.sync.set({ linkPreferences: prefsToSave }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Error saving preferences:', chrome.runtime.lastError.message);
                        showMessage('Error saving preferences.');
                    } else {
                        showMessage('Preferences saved successfully!');
                        setTimeout(() => window.close(), 1500);
                    }
                });
            }
        });
    });
});