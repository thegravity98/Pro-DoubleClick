// contentscripts.js
// This script runs in the context of every web page to handle double-click events on links.

// Use setTimeout to ensure the DOM is fully loaded before attaching listeners.
setTimeout(() => {
	let tid = null; // Timer ID for single-click delay
	let _last = null; // Stores the last clicked element to detect double-clicks
	let preferences = {}; // Stores global link opening preferences
	let sitePreferences = {}; // Stores site-specific preferences (e.g., for "theverge.com")
	let customDomains = {}; // Stores preferences for custom defined domains

	// Get the current domain and hostname
	const domain = window.location.toString();
	const hostname = window.location.hostname;
	// Determine if the current domain is a known search engine
	const isSearchEngine = domain.includes("google.com") || domain.includes("search.brave.com") || domain.includes("duckduckgo.com");

	/**
	 * Loads preferences from Chrome's synchronized storage.
	 * This function is called on script initialization and when storage changes.
	 */
	function loadPreferences() {
		// Check if chrome.storage API is available (it is in a Chrome Extension context)
		if (typeof chrome !== 'undefined' && chrome.storage) {
			chrome.storage.sync.get(['linkPreferences', 'sitePreferences', 'customDomains'], (data) => {
				// Assign loaded preferences, or empty objects if not found
				preferences = data.linkPreferences || {};
				sitePreferences = data.sitePreferences || {};
				customDomains = data.customDomains || {};
				console.log('Pro DoubleClick: Loaded preferences:', preferences);
			});
		}
	}

	// Initial load of preferences when the script starts
	loadPreferences();

	// Listen for changes in Chrome storage and reload preferences
	if (typeof chrome !== 'undefined' && chrome.storage) {
		chrome.storage.onChanged.addListener((changes, namespace) => {
			if (namespace === 'sync') {
				loadPreferences(); // Reload preferences when storage changes
			}
		});
	}

	/**
	 * Checks if a given DOM node is an HTML link element (<a> or <area> with href, or <link>).
	 * @param {Node} aNode - The DOM node to check.
	 * @returns {boolean} - True if the node is an HTML link, false otherwise.
	 */
	function isHtmlLink(aNode) {
		return ((aNode instanceof HTMLAnchorElement && aNode.href) || (aNode instanceof HTMLAreaElement && aNode.href) || aNode instanceof HTMLLinkElement);
	}
	
	/**
	 * Determines the desired tab opening behavior (foreground/background) based on
	 * site-specific, custom domain, and global preferences, in that order of precedence.
	 * @returns {{ctrl: boolean, shift: boolean}} - An object indicating the ctrlKey and shiftKey
	 * states needed to simulate the desired click.
	 */
	function determineTabBehavior() {
		// 1. Check site-specific preferences (highest priority)
		if (sitePreferences[hostname]) {
			return sitePreferences[hostname] === 'foreground' ? { ctrl: true, shift: true } : { ctrl: true, shift: false };
		}

		// 2. Check custom domain preferences
		if (customDomains[hostname]) {
			return customDomains[hostname] === 'foreground' ? { ctrl: true, shift: true } : { ctrl: true, shift: false };
		}

		// 3. Check global preferences (if no site-specific or custom domain preference)
		if (preferences.opt1) { // Open all links in new foreground tab
			return { ctrl: true, shift: true };
		}
		
		if (preferences.opt2) { // Open all links in new background tab
			return { ctrl: true, shift: false };
		}
		
        // New combined option 1: Search Engine Foreground, Non-Search Engine Background
		if (preferences.opt_seF_nseB) { 
			return isSearchEngine ? { ctrl: true, shift: true } : { ctrl: true, shift: false };
		}
		
        // New combined option 2: Search Engine Background, Non-Search Engine Foreground
		if (preferences.opt_seB_nseF) { 
			return isSearchEngine ? { ctrl: true, shift: false } : { ctrl: true, shift: true };
		}

		// 4. Default behavior: search engines in background, others in foreground
        // This default is equivalent to opt_seB_nseF if no other global option is set.
		return isSearchEngine ? { ctrl: true, shift: false } : { ctrl: true, shift: true };
	}

	/**
	 * Handles the double-click event on a tab.
	 * It prevents default double-click behavior and dispatches a new click event
	 * with modified ctrlKey/shiftKey based on determined tab behavior.
	 * @param {MouseEvent} e - The original double-click MouseEvent.
	 */
	function dbclickTab(e) {
		e.preventDefault(); // Prevent default double-click action
		e.stopPropagation(); // Stop event propagation
		clearTimeout(tid); // Clear any pending single-click timer
		
		const behavior = determineTabBehavior(); // Get the desired tab opening behavior
		
		// Create a new MouseEvent with modified properties to simulate desired tab opening
		const newEvent = new MouseEvent("click", Object.defineProperties(e, { 
			detail: { value: 1 }, // Ensure it's treated as a single click
			ctrlKey: { value: behavior.ctrl }, // Set ctrlKey based on behavior
			shiftKey: { value: behavior.shift } // Set shiftKey based on behavior
		}));
		newEvent.stopPropagation(); // Stop propagation of the new event
		e.target.dispatchEvent(newEvent); // Dispatch the new event on the original target
	}

	/**
	 * Handles all click events on the page to detect single and double clicks on links.
	 * @param {MouseEvent} e - The original click MouseEvent.
	 */
	function onClick(e) {
		// Ignore clicks that are not trusted, not left-button clicks, or involve modifier keys
		if (!e.isTrusted || e.button != 0 || e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) {
			return;
		}

		// Handle single clicks (e.detail == 1)
		if (e.detail == 1) {
			// Traverse up the DOM tree to find if the clicked element is part of an HTML link
			for (var node = e.target; node && !isHtmlLink(node); node = node.parentNode);
			console.log("isLinkNode: " + !!node); // Log if a link node was found
			
			// If a link node is found and its href is not just "#"
			if (node && node.getAttribute("href") != "#") {
				_last = e.target; // Store the target for double-click detection
				e.preventDefault(); // Prevent default single-click action immediately
				e.stopPropagation(); // Stop event propagation
				// Set a timeout to allow the original click behavior after a delay
				// This allows time for a potential second click (double-click)
				tid = setTimeout(() => {
					// If we reach here, it's a single click - allow normal navigation
					window.location.href = node.href;
				}, 300);
			}
		}

		// Handle double clicks (e.detail == 2)
		// Ensure it's a double-click on the same element as the last single click
		if (e.detail == 2 && _last == e.target) {
			dbclickTab(e); // Process the double-click
		}
	}
	
	// Add a click event listener to the document, capturing phase (true)
	// This ensures our listener runs before other listeners on the page.
	addEventListener("click", onClick, true);
}, 0); // Run this script after a minimal delay to ensure DOM readiness