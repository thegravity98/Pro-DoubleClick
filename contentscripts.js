setTimeout(() => {
	let tid = null, _last = null;
	const domain = window.location.toString();
	const isSearchEngine = domain.includes("google.com") || domain.includes("search.brave.com") || domain.includes("you.com");

	function isHtmlLink(aNode) {
		return ((aNode instanceof HTMLAnchorElement && aNode.href) || (aNode instanceof HTMLAreaElement && aNode.href) || aNode instanceof HTMLLinkElement);
	};
	
	function dbclickTab(e, shift) {
		e.preventDefault();
		e.stopPropagation();
		clearTimeout(tid);
		const newEvent = new MouseEvent("click", Object.defineProperties(e, { detail: { value: 1 }, ctrlKey: { value: true }, shiftKey: { value: shift } }));
		newEvent.stopPropagation();
		e.target.dispatchEvent(newEvent);
	}

	function onClick(e) {
		
		if (!e.isTrusted || e.button != 0 || e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) {
			return;
		}

		if (e.detail == 1) {
			for (var node = e.target; node && !isHtmlLink(node); node = node.parentNode);
			console.log("isLinkNode: " + !!node);
			if (node && node.getAttribute("href") != "#") {
				_last = e.target;
				const delayEvent = new MouseEvent(e.type, e);
				e.preventDefault();
				e.stopPropagation();
				tid = setTimeout(() => e.target.dispatchEvent(delayEvent), 300);
			}
		}

		if (e.detail == 2 && _last == e.target) {
			dbclickTab(e, !isSearchEngine);
		}

	}
	addEventListener("click", onClick, true);
}, 0);
