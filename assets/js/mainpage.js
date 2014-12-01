window.addEventListener('hashchange', function() {
    // If there is a currently selected page
    if(typeof _currentpage !== 'undefined') {
        // Hide the current page
        _currentpage.style.setProperty('display', 'none');
    }

    // Make sure the hash has data
    if (location.hash != '') {
        // Make sure that the pages are viewable
        document.getElementById('pages').style.setProperty('display', 'block');

        // Update the current page (leak the variable to global scope)
        _currentpage = document.getElementsByName(location.hash.substring(1))[0];

        // Show the current page
        _currentpage.style.setProperty('display', 'block');

    // The hash didn't have data so we're going to show my resume
    } else {
        // Hide the pages (and the background)
        location.hash = 'resume';
    }
});

window.addEventListener('load', function() {
    var anchors = document.getElementsByTagName('a');
    for(i = 0, len=anchors.length; i<len; i++){
        anchors[i].addEventListener('click', function(e) {
            if (e.target.hash != '') {
                location.hash = e.target.hash.substring(1);
                e.preventDefault();
            }
        });
    }

    window.dispatchEvent(new HashChangeEvent('hashchange'));
});
