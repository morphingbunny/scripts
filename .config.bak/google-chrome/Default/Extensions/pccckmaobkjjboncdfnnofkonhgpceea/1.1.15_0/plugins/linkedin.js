var hoverZoomPlugins = hoverZoomPlugins || [];
hoverZoomPlugins.push({
    name: 'LinkedIn',
    version: '0.4',

    prepareImgLinks: function (callback) {
        var pluginName = this.name;
        var JSESSIONIDCookie = getCookie("JSESSIONID").replace(/"/g, '');

        // individuals
        $('a[href*="/in/"]:not([href*="/detail/"]):not(.hoverZoomMouseover)').addClass('hoverZoomMouseover').one('mouseover', function () {
            var link = $(this);
            fetchProfile(link, 'href');
        });

        // companies
        $('a[href*="/company/"]:not(.hoverZoomMouseover)').addClass('hoverZoomMouseover').one('mouseover', function () {
            var link = $(this);
            fetchCompany(link, 'href');
        });

        // parse url to extract company's id then call API to find url of fullsize company photo
        // NB: API can not be called using company name, we need its id
        function fetchCompany(link, attr) {
            let url = link.prop(attr);
            let companyId = null;

            // sample: https://www.linkedin.com/company/1951
            // => companyId = 1951
            let regexCompanyId = /\/company\/([0-9]{2,})/;
            let matchesCompanyId = url.match(regexCompanyId);
            if (matchesCompanyId) companyId = matchesCompanyId.length > 1 ? matchesCompanyId[1] : null;

            if (companyId == null) {
                // sample: https://www.linkedin.com/company/celsius-therapeutics/?miniCompanyUrn=urn%3Ali%3Afs_miniCompany%3A28591021
                // => companyId = 28591021
                let regexCompanyId = /\/company\/.*(?:%3A|:)([0-9]{2,})/;
                let matchesCompanyId = url.match(regexCompanyId);
                if (matchesCompanyId) companyId = matchesCompanyId.length > 1 ? matchesCompanyId[1] : null;
            }

            if (companyId == null) return;

            let storedUrl = null;
            let storedCaption = null;
            // check sessionStorage in case fullsize url was already found
            if (companyId) {
                storedUrl = sessionStorage.getItem(companyId + "_url");
                storedCaption = sessionStorage.getItem(companyId + "_caption");
            }

            if (storedUrl == null) {
                // call Linkedin API
                $.ajax({
                    type: "GET",
                    dataType: 'text',
                    beforeSend: function (request) {
                        request.setRequestHeader("csrf-token", JSESSIONIDCookie);
                    },
                    url: "https://www.linkedin.com/voyager/api/entities/companies/" + companyId,
                    success: function (response) { extractCompanyPhoto(link, companyId, response); },
                    error: function (response) { }
                });
            } else {
                let data = link.data();
                if (data.hoverZoomSrc == undefined) {
                    data.hoverZoomSrc = [];
                }
                data.hoverZoomSrc.unshift(storedUrl);
                data.hoverZoomCaption = storedCaption;
                callback(link, pluginName);
            }
        }

        // parse url to extract profile's name then call API to find url of fullsize profile photo
        function fetchProfile(link, attr) {
            let url = link.prop(attr);

            // sample: https://www.linkedin.com/in/williamhgates/
            // => profileName = williamhgates
            // sample: https://www.linkedin.com/in/bertranddesmier?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAAAE1RYkBGL--8b3ox_rRCqx51SuSn_l1-FY
            // => profileName = bertranddesmier
            let regexProfileName = /\/in\/([^\/\?]{1,})/;
            let matchesProfileName = url.match(regexProfileName);
            let profileName = null;
            if (matchesProfileName) profileName = matchesProfileName.length > 1 ? matchesProfileName[1] : null;

            if (profileName == null) return;

            let storedUrl = null;
            let storedCaption = null;
            // check sessionStorage in case fullsize url was already found
            if (profileName) {
                storedUrl = sessionStorage.getItem(profileName + "_url");
                storedCaption = sessionStorage.getItem(profileName + "_caption");
            }

            if (storedUrl == null) {
                // Use Dash Profiles API
                $.ajax({
                    type: "GET",
                    dataType: 'text',
                    beforeSend: function (request) {
                        request.setRequestHeader("csrf-token", JSESSIONIDCookie);
                        request.setRequestHeader("accept", "application/vnd.linkedin.normalized+json+2.1");
                        request.setRequestHeader("x-li-lang", "en_US");
                        request.setRequestHeader("x-restli-protocol-version", "2.0.0");
                    },
                    url: "https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=" + encodeURIComponent(profileName) + "&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93",
                    success: function (response) { extractProfilePhoto(link, profileName, response); },
                    error: function (response) {
                        // Fallback to old API if dash fails
                        $.ajax({
                            type: "GET",
                            dataType: 'text',
                            beforeSend: function (request) {
                                request.setRequestHeader("csrf-token", JSESSIONIDCookie);
                            },
                            url: "https://www.linkedin.com/voyager/api/identity/profiles/" + encodeURIComponent(profileName),
                            success: function (response) { extractProfilePhotoLegacy(link, profileName, response); },
                            error: function (response) { }
                        });
                    }
                });
            } else {
                let data = link.data();
                if (data.hoverZoomSrc == undefined) {
                    data.hoverZoomSrc = [];
                }
                data.hoverZoomSrc.unshift(storedUrl);
                data.hoverZoomCaption = storedCaption;
                callback(link, pluginName);
            }
        }

        function extractCompanyPhoto(link, companyId, response) {
            try {
                let j = JSON.parse(response);
                let rootUrl = j.basicCompanyInfo.miniCompany.logo["com.linkedin.common.VectorImage"].rootUrl;
                let nbPictures = j.basicCompanyInfo.miniCompany.logo["com.linkedin.common.VectorImage"].artifacts.length;
                let largestPicture = j.basicCompanyInfo.miniCompany.logo["com.linkedin.common.VectorImage"].artifacts[nbPictures - 1].fileIdentifyingUrlPathSegment;
                let fullsizeUrl = rootUrl + largestPicture;
                let caption = j.basicCompanyInfo.miniCompany.name;

                let data = link.data();
                if (data.hoverZoomSrc == undefined) {
                    data.hoverZoomSrc = [];
                }
                data.hoverZoomSrc.unshift(fullsizeUrl);
                data.hoverZoomCaption = caption;

                // store url & caption
                sessionStorage.setItem(companyId + "_url", fullsizeUrl);
                sessionStorage.setItem(companyId + "_caption", caption);
                callback(link, pluginName);
                hoverZoom.displayPicFromElement(link);

            } catch { }
        }

        function extractProfilePhoto(link, profileName, response) {
            try {
                let j = JSON.parse(response);

                // New Dash API response structure
                let rootUrl = null;
                let artifacts = null;
                let firstName = '';
                let lastName = '';
                let headline = '';

                let primaryUrn = null;
                if (j.data) {
                    if (Array.isArray(j.data.elements) && j.data.elements.length > 0) {
                        let firstEl = j.data.elements[0];
                        if (typeof firstEl === 'string') {
                            primaryUrn = firstEl;
                        } else if (firstEl && typeof firstEl === 'object') {
                            primaryUrn = firstEl.profileUrn || firstEl.entityUrn || firstEl["*profile"] || firstEl["*elements"];
                            if (Array.isArray(primaryUrn) && primaryUrn.length > 0) primaryUrn = primaryUrn[0];
                        }
                    } else if (Array.isArray(j.data["*elements"]) && j.data["*elements"].length > 0) {
                        primaryUrn = j.data["*elements"][0];
                    }
                }

                // Extract from included array (Dash API format)
                let candidateItems = [];
                if (j.included) {
                    for (let item of j.included) {
                        let vi = null;
                        if (item.profilePicture && item.profilePicture.displayImageReference) {
                            vi = item.profilePicture.displayImageReference.vectorImage;
                        } else if (item.$type && item.$type.includes("Profile") && item.profilePicture && item.profilePicture.displayImageReference) {
                            vi = item.profilePicture.displayImageReference.vectorImage;
                        }

                        if (vi && vi.rootUrl && vi.artifacts) {
                            candidateItems.push({ item: item, vi: vi });
                        }
                    }
                }

                if (candidateItems.length > 0) {
                    let bestCandidate = candidateItems[0];
                    let matchFound = false;

                    if (primaryUrn) {
                        for (let c of candidateItems) {
                            if (c.item.entityUrn === primaryUrn || c.item.objectUrn === primaryUrn) {
                                bestCandidate = c;
                                matchFound = true;
                                break;
                            }
                        }
                    }

                    if (!matchFound && profileName) {
                        for (let c of candidateItems) {
                            if (c.item.publicIdentifier && c.item.publicIdentifier.toLowerCase() === profileName.toLowerCase()) {
                                bestCandidate = c;
                                matchFound = true;
                                break;
                            }
                        }
                    }

                    rootUrl = bestCandidate.vi.rootUrl;
                    artifacts = bestCandidate.vi.artifacts;
                    firstName = bestCandidate.item.firstName || '';
                    lastName = bestCandidate.item.lastName || '';
                    headline = bestCandidate.item.headline || '';
                }

                if (rootUrl && artifacts && artifacts.length > 0) {
                    artifacts.sort((a, b) => (b.width || 0) - (a.width || 0));
                    let largestPicture = artifacts[0].fileIdentifyingUrlPathSegment;
                    let fullsizeUrl = rootUrl + largestPicture;
                    let caption = firstName + " " + lastName + (headline ? " - " + headline : "");

                    let data = link.data();
                    if (data.hoverZoomSrc == undefined) {
                        data.hoverZoomSrc = [];
                    }
                    data.hoverZoomSrc.unshift(fullsizeUrl);
                    data.hoverZoomCaption = caption.trim();

                    // store url & caption
                    sessionStorage.setItem(profileName + "_url", fullsizeUrl);
                    sessionStorage.setItem(profileName + "_caption", caption.trim());
                    callback(link, pluginName);
                    hoverZoom.displayPicFromElement(link);
                }
            } catch (e) {
                console.log("Dash API parse error:", e);
            }
        }

        function extractProfilePhotoLegacy(link, profileName, response) {
            try {
                let j = JSON.parse(response);
                let picture = j.miniProfile && j.miniProfile.picture;
                if (!picture || !picture["com.linkedin.common.VectorImage"]) return;

                let rootUrl = picture["com.linkedin.common.VectorImage"].rootUrl;
                let artifacts = picture["com.linkedin.common.VectorImage"].artifacts;

                if (rootUrl && artifacts && artifacts.length > 0) {
                    artifacts.sort((a, b) => (b.width || 0) - (a.width || 0));
                    let largestPicture = artifacts[0].fileIdentifyingUrlPathSegment;
                    let fullsizeUrl = rootUrl + largestPicture;
                    let caption = (j.firstName || "") + " " + (j.lastName || "") + (j.headline ? " - " + j.headline : "");

                    let data = link.data();
                    if (data.hoverZoomSrc == undefined) {
                        data.hoverZoomSrc = [];
                    }
                    data.hoverZoomSrc.unshift(fullsizeUrl);
                    data.hoverZoomCaption = caption.trim();

                    // store url & caption
                    sessionStorage.setItem(profileName + "_url", fullsizeUrl);
                    sessionStorage.setItem(profileName + "_caption", caption.trim());
                    callback(link, pluginName);
                    hoverZoom.displayPicFromElement(link);
                }
            } catch (e) {
                console.log("Legacy API parse error:", e);
            }
        }

        function getCookie(cname) {
            var name = cname + "=";
            var decodedCookie = decodeURIComponent(document.cookie);
            var ca = decodedCookie.split(';');
            for (var i = 0; i < ca.length; i++) {
                var c = ca[i];
                while (c.charAt(0) == ' ') {
                    c = c.substring(1);
                }
                if (c.toLowerCase().indexOf(name.toLowerCase()) == 0) {
                    return c.substring(name.length, c.length);
                }
            }
            return "";
        }

        var res = [];

        hoverZoom.urlReplace(res,
            'img[src*="/shrink_"]',
            /\/shrink_.*?\//,
            '/'
        );

        callback($(res), this.name);
    }
});
