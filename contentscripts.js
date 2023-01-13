setTimeout(() => {
	var tid = null, _last = null;
	var domain = window.location.toString();
	var shift;
	var isBraveSearch = false;
	var isGoogleSearch = false;
	var isYouAISearch = false;
	//console.log("domain is " + domain);

	if (domain.includes("google.com")) { isGoogleSearch = true; }
	if (domain.includes("search.brave.com")) { isBraveSearch = true; }
	if (domain.includes("you.com")) { isYouAISearch = true; }

	function isHtmlLink(aNode) {
		return ((aNode instanceof HTMLAnchorElement && aNode.href) || (aNode instanceof HTMLAreaElement && aNode.href) || aNode instanceof HTMLLinkElement);
	};

	function onClick(e) {

		function dbclickTab(shift) {
			e.preventDefault();
			e.stopPropagation();
			clearTimeout(tid);
			var evt = new MouseEvent("click", Object.defineProperties(e, { detail: { value: 1 }, ctrlKey: { value: true }, shiftKey: { value: shift } }));
			evt.stopPropagation();
			e.target.dispatchEvent(evt);
		}

		if (!e.isTrusted || e.button != 0 || e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) {
			return;
		}

		if (e.detail == 1) {
			for (var node = e.target; node && !isHtmlLink(node); node = node.parentNode);
			console.log("isLinkNode: " + !!node);
			if (node && node.getAttribute("href") != "#") {
				_last = e.target;
				var evt = new MouseEvent(e.type, e);
				e.preventDefault();
				e.stopPropagation();
				tid = setTimeout(() => e.target.dispatchEvent(evt), 300);
			}
		}

		if (e.detail == 2 && _last == e.target) {
			if (isGoogleSearch || isBraveSearch || isYouAISearch) {
				shift = false;
				dbclickTab(shift);
			}
			if (!isGoogleSearch && !isBraveSearch && !isYouAISearch) {
				shift = true;
				dbclickTab(shift);
			}
		}

	}
	addEventListener("click", onClick, true);
}, 0);


