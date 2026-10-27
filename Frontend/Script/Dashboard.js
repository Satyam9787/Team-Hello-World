/* =========================================================
   THE ARCHIVE — PROFILE PAGE
   Profile interactions + backend user data
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       PROFILE DATA
       ===================================================== */

    const profile = {
        name: "New Scholar",
        firstName: "@newscholar",
        bio: "Begin your journey through the Archive.",

        followers: 0,
        following: 0,
        sprints: 0,
        questions: 0,
        contests: 0,
        tournaments: 0,

        skills: [],

        connectedAccounts: {
            github: false,
            linkedin: false,
            leetcode: false,
            codechef: false
        }
    };


    /* =====================================================
       HELPER FUNCTIONS
       ===================================================== */

    function getElement(id) {
        return document.getElementById(id);
    }


    function showToast(message, type = "success") {

        let toast = document.querySelector(".toast");

        if (!toast) {
            toast = document.createElement("div");
            toast.className = "toast";
            document.body.appendChild(toast);
        }

        toast.textContent = message;

        toast.classList.remove("success", "error", "warning");
        toast.classList.add(type);

        toast.classList.add("show");

        setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }


    /* =====================================================
       AVATAR INITIALS
       ===================================================== */

    function updateAvatarInitials(name) {

    const profileInitialsElement =
        getElement("profileAvatarInitials");

    const navInitialsElement =
        getElement("navAvatarInitials");

    if (!name || name.trim() === "") {

        if (profileInitialsElement) {
            profileInitialsElement.textContent = "--";
        }

        if (navInitialsElement) {
            navInitialsElement.textContent = "--";
        }

        return;
    }

    const parts = name.trim().split(/\s+/);

    let initials = "";

    if (parts.length === 1) {

        initials =
            parts[0].substring(0, 2);

    } else {

        initials =
            parts[0].charAt(0) +
            parts[parts.length - 1].charAt(0);
    }

    initials = initials.toUpperCase();


    // Main profile avatar
    if (profileInitialsElement) {
        profileInitialsElement.textContent =
            initials;
    }


    // Navbar avatar
    if (navInitialsElement) {
        navInitialsElement.textContent =
            initials;
    }
}


    /* =====================================================
       PROFILE PHOTO
       ===================================================== */

    const photoInput = getElement("photoInput");
    const avatarPreview = getElement("avatarImage");
    const avatarInitials = getElement("profileAvatarInitials");


    function displayProfilePhoto(photoPath) {

        if (!avatarPreview) {
            return;
        }

        if (!photoPath) {

            avatarPreview.removeAttribute("src");
            avatarPreview.style.display = "none";

            if (avatarInitials) {
                avatarInitials.style.display = "flex";
            }

            return;
        }

        avatarPreview.src = photoPath;

        avatarPreview.onload = () => {

            avatarPreview.style.display = "block";

            if (avatarInitials) {
                avatarInitials.style.display = "none";
            }
        };

        avatarPreview.onerror = () => {

            console.error(
                "Unable to load profile photo:",
                photoPath
            );

            avatarPreview.style.display = "none";

            if (avatarInitials) {
                avatarInitials.style.display = "flex";
            }
        };
    }


    /* =====================================================
       PHOTO INPUT
       ===================================================== */

    if (photoInput) {

        photoInput.addEventListener("change", async function (event) {

            const file = event.target.files?.[0];

            if (!file) {
                return;
            }


            /* ---------------------------------------------
               Basic validation
               --------------------------------------------- */

            if (!file.type.startsWith("image/")) {

                showToast(
                    "Please select a valid image.",
                    "error"
                );

                photoInput.value = "";
                return;
            }


            const maxSize = 5 * 1024 * 1024;

            if (file.size > maxSize) {

                showToast(
                    "Image must be smaller than 5 MB.",
                    "error"
                );

                photoInput.value = "";
                return;
            }


            /* ---------------------------------------------
               Preview locally while uploading
               --------------------------------------------- */

            const reader = new FileReader();

            reader.onload = function (event) {

                if (!avatarPreview) {
                    return;
                }

                avatarPreview.src = event.target.result;
                avatarPreview.style.display = "block";

                if (avatarInitials) {
                    avatarInitials.style.display = "none";
                }
            };

            reader.readAsDataURL(file);


            /* ---------------------------------------------
               Upload image to backend
               --------------------------------------------- */

            try {

                showToast(
                    "Uploading profile photo...",
                    "success"
                );


                const formData = new FormData();

                formData.append(
                    "profile_photo",
                    file
                );


                const response = await fetch(
                    "/update_profile_photo",
                    {
                        method: "POST",
                        credentials: "include",
                        body: formData
                    }
                );


                if (!response.ok) {

                    throw new Error(
                        `Upload failed with status ${response.status}`
                    );
                }


                const data = await response.json();

                console.log(
                    "Profile photo upload response:",
                    data
                );


                /*
                 * Backend can return any one of these:
                 *
                 * {
                 *     profilePhoto: "/uploads/abc.jpg"
                 * }
                 *
                 * OR
                 *
                 * {
                 *     photoPath: "/uploads/abc.jpg"
                 * }
                 *
                 * OR
                 *
                 * {
                 *     imagePath: "/uploads/abc.jpg"
                 * }
                 *
                 * OR
                 *
                 * {
                 *     path: "/uploads/abc.jpg"
                 * }
                 */

                const photoPath =
                    data.profilePhoto ||
                    data.profile_photo ||
                    data.photoPath ||
                    data.imagePath ||
                    data.path;


                if (photoPath) {

                    displayProfilePhoto(photoPath);

                    showToast(
                        "Profile photo updated successfully.",
                        "success"
                    );

                } else {

                    /*
                     * Upload may still have succeeded even
                     * if backend doesn't return the path.
                     *
                     * Fetch user data again so that the
                     * database value can be retrieved.
                     */

                    await fetchUserData();

                    showToast(
                        "Profile photo uploaded successfully.",
                        "success"
                    );
                }


                updateProfileCompletion();

            } catch (error) {

                console.error(
                    "Profile photo upload error:",
                    error
                );

                showToast(
                    "Failed to upload profile photo.",
                    "error"
                );
            }


            /*
             * Allow selecting the same image again.
             */

            photoInput.value = "";
        });
    }


    /* =====================================================
       FETCH USER DATA
       ===================================================== */

    async function fetchUserData() {

        try {

            console.log(
                "Fetching user data from /Fetch_user_data..."
            );


            const response = await fetch(
                "/Fetch_user_data",
                {
                    method: "GET",

                    credentials: "include",

                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );


            if (!response.ok) {

                throw new Error(
                    `Fetch user data failed: ${response.status}`
                );
            }


            const data = await response.json();


            console.log(
                "User data received:",
                data
            );


            /* =================================================
               FIRST NAME
               ================================================= */

            if (data.firstName) {

                const fullNameElement =
                    getElement("userFullName");

                if (fullNameElement) {
                    fullNameElement.textContent =
                        data.firstName;
                }


                profile.name = data.firstName;


                updateAvatarInitials(
                    data.firstName
                );
            }


            /* =================================================
               USERNAME
               ================================================= */

            if (data.username) {

                const handleElement =
                    getElement("userHandle");

                if (handleElement) {

                    let username =
                        data.username;

                    if (!username.startsWith("@")) {
                        username = "@" + username;
                    }

                    handleElement.textContent =
                        username;
                }


                profile.firstName =
                    data.username;
            }

            else if (data.firstName) {

                const handleElement =
                    getElement("userHandle");

                if (handleElement) {

                    handleElement.textContent =
                        "@" +
                        data.firstName
                            .toLowerCase()
                            .replace(/\s+/g, "");
                }
            }


            /* =================================================
               MONGODB OBJECT ID
               ================================================= */

            if (data.Id) {

                console.log(
                    "MongoDB User ID:",
                    data.Id
                );
            }


            /* =================================================
               PROFILE PHOTO
               ================================================= */

            const photoPath =
                data.profilePhoto ||
                data.profile_photo ||
                data.photoPath ||
                data.imagePath ||
                data.profileImage ||
                data.profile_image;


            if (photoPath) {

                displayProfilePhoto(
                    photoPath
                );

            } else {

                /*
                 * No backend photo exists.
                 * Show initials.
                 */

                displayProfilePhoto(null);

                if (data.firstName) {

                    updateAvatarInitials(
                        data.firstName
                    );
                }
            }


            updateProfileCompletion();


            showToast(
                `Welcome back, ${data.firstName || "Scholar"}!`,
                "success"
            );


            return data;

        } catch (error) {

            console.error(
                "fetchUserData() error:",
                error
            );


            const fullNameElement =
                getElement("userFullName");

            if (fullNameElement) {

                /*
                 * Don't leave the page permanently
                 * stuck at Loading...
                 */

                fullNameElement.textContent =
                    "Scholar";
            }


            const handleElement =
                getElement("userHandle");

            if (handleElement) {
                handleElement.textContent =
                    "@scholar";
            }


            updateAvatarInitials(
                "Scholar"
            );
        }
    }


    /* =====================================================
       PROFILE COMPLETION
       ===================================================== */

    function updateProfileCompletion() {

        const nameComplete =
            profile.name &&
            profile.name !== "New Scholar";


        const bioComplete =
            profile.bio &&
            profile.bio.trim() !== "";


        const skillsComplete =
            profile.skills &&
            profile.skills.length > 0;


        const avatarComplete =
            avatarPreview &&
            avatarPreview.style.display !== "none" &&
            avatarPreview.src;


        const completed =
            [
                nameComplete,
                bioComplete,
                skillsComplete,
                avatarComplete
            ].filter(Boolean).length;


        const percentage =
            completed * 25;


        const progressElements =
            document.querySelectorAll(
                "[data-profile-completion]"
            );


        progressElements.forEach(
            element => {
                element.textContent =
                    `${percentage}%`;
            }
        );


        /*
         * Support common IDs if they exist
         * in the HTML.
         */

        const completion =
            getElement("profileCompletion");

        if (completion) {
            completion.textContent =
                `${percentage}%`;
        }


        const progressBar =
            getElement("profileProgress");

        if (progressBar) {
            progressBar.style.width =
                `${percentage}%`;
        }
    }


    /* =====================================================
       STATS
       ===================================================== */

    function updateStats() {

        const stats = {
            followers: profile.followers,
            following: profile.following,
            sprints: profile.sprints,
            questions: profile.questions,
            contests: profile.contests,
            tournaments: profile.tournaments
        };


        Object.entries(stats).forEach(
            ([key, value]) => {

                const element =
                    getElement(key);

                if (element) {
                    element.textContent =
                        value;
                }
            }
        );
    }


    /* =====================================================
       SKILLS
       ===================================================== */

    function renderSkills() {

        const skillsList =
            getElement("skillsList");

        if (!skillsList) {
            return;
        }


        skillsList.innerHTML = "";


        if (!profile.skills.length) {

            const empty =
                document.createElement("div");

            empty.className =
                "empty-skills";

            empty.textContent =
                "No skills added yet.";

            skillsList.appendChild(
                empty
            );

            return;
        }


        profile.skills.forEach(
            skill => {

                const skillElement =
                    document.createElement("div");

                skillElement.className =
                    "skill-item";


                const name =
                    document.createElement("span");

                name.className =
                    "skill-name";

                name.textContent =
                    skill.name;


                const level =
                    document.createElement("span");

                level.className =
                    "skill-level";

                level.textContent =
                    skill.level || "Beginner";


                skillElement.appendChild(
                    name
                );

                skillElement.appendChild(
                    level
                );


                skillsList.appendChild(
                    skillElement
                );
            }
        );
    }


    /* =====================================================
       ADD SKILL MODAL
       ===================================================== */

    const addSkillBtn =
        getElement("addSkillBtn");

    const skillModal =
        getElement("skillModal");

    const saveSkill =
        getElement("saveSkill");

    const skillName =
        getElement("skillName");

    const skillLevel =
        getElement("skillLevel");


    if (addSkillBtn && skillModal) {

        addSkillBtn.addEventListener(
            "click",
            () => {

                skillModal.style.display =
                    "flex";
            }
        );
    }


    if (saveSkill) {

        saveSkill.addEventListener(
            "click",
            () => {

                const name =
                    skillName?.value.trim();

                const level =
                    skillLevel?.value || "Beginner";


                if (!name) {

                    showToast(
                        "Please enter a skill.",
                        "warning"
                    );

                    return;
                }


                profile.skills.push({
                    name,
                    level
                });


                renderSkills();

                updateProfileCompletion();


                if (skillModal) {
                    skillModal.style.display =
                        "none";
                }


                if (skillName) {
                    skillName.value = "";
                }


                showToast(
                    "Skill added successfully.",
                    "success"
                );
            }
        );
    }


    /* =====================================================
       CLOSE MODALS
       ===================================================== */

    document.addEventListener(
        "click",
        event => {

            if (
                event.target.classList.contains(
                    "modal"
                )
            ) {

                event.target.style.display =
                    "none";
            }
        }
    );


    /* =====================================================
       EDIT PROFILE
       ===================================================== */

    const editBtn =
        getElement("editBtn");

    const editModal =
        getElement("editModal");

    const editName =
        getElement("editName");

    const editUsername =
        getElement("editUsername");

    const editBio =
        getElement("editBio");

    const saveProfile =
        getElement("saveProfile");


    if (editBtn && editModal) {

        editBtn.addEventListener(
            "click",
            () => {

                if (editName) {
                    editName.value =
                        profile.name;
                }


                if (editUsername) {
                    editUsername.value =
                        profile.firstName;
                }


                if (editBio) {
                    editBio.value =
                        profile.bio;
                }


                editModal.style.display =
                    "flex";
            }
        );
    }


    if (saveProfile) {

        saveProfile.addEventListener(
            "click",
            () => {

                const newName =
                    editName?.value.trim();

                const newUsername =
                    editUsername?.value.trim();

                const newBio =
                    editBio?.value.trim();


                if (newName) {

                    profile.name =
                        newName;


                    const nameElement =
                        getElement("userFullName");

                    if (nameElement) {
                        nameElement.textContent =
                            newName;
                    }


                    updateAvatarInitials(
                        newName
                    );
                }


                if (newUsername) {

                    profile.firstName =
                        newUsername;


                    const handleElement =
                        getElement("userHandle");

                    if (handleElement) {

                        handleElement.textContent =
                            newUsername.startsWith("@")
                                ? newUsername
                                : "@" + newUsername;
                    }
                }


                if (newBio) {
                    profile.bio =
                        newBio;
                }


                updateProfileCompletion();


                if (editModal) {
                    editModal.style.display =
                        "none";
                }


                showToast(
                    "Profile updated.",
                    "success"
                );
            }
        );
    }


    /* =====================================================
       COPY HANDLE
       ===================================================== */

    const copyHandle =
        getElement("copyHandle");


    if (copyHandle) {

        copyHandle.addEventListener(
            "click",
            async () => {

                const handleElement =
                    getElement("userHandle");

                const handle =
                    handleElement?.textContent || "";


                try {

                    await navigator.clipboard.writeText(
                        handle
                    );

                    showToast(
                        "Handle copied.",
                        "success"
                    );

                } catch (error) {

                    console.error(
                        "Clipboard error:",
                        error
                    );

                    showToast(
                        "Unable to copy handle.",
                        "error"
                    );
                }
            }
        );
    }


    /* =====================================================
       THEME
       ===================================================== */

    const themeBtn =
        getElement("themeBtn");


    if (themeBtn) {

        themeBtn.addEventListener(
            "click",
            () => {

                document.body.classList.toggle(
                    "dark-mode"
                );

                const dark =
                    document.body.classList.contains(
                        "dark-mode"
                    );

                localStorage.setItem(
                    "archive_theme",
                    dark
                        ? "dark"
                        : "light"
                );
            }
        );
    }


    /* =====================================================
       LOAD THEME
       ===================================================== */

    const savedTheme =
        localStorage.getItem(
            "archive_theme"
        );


    if (savedTheme === "dark") {

        document.body.classList.add(
            "dark-mode"
        );
    }


    /* =====================================================
       FOLLOW BUTTON
       ===================================================== */

    const followBtn =
        getElement("followBtn");


    if (followBtn) {

        followBtn.addEventListener(
            "click",
            () => {

                const isFollowing =
                    followBtn.dataset.following ===
                    "true";


                if (isFollowing) {

                    followBtn.dataset.following =
                        "false";

                    followBtn.textContent =
                        "Follow";

                    profile.followers =
                        Math.max(
                            0,
                            profile.followers - 1
                        );

                } else {

                    followBtn.dataset.following =
                        "true";

                    followBtn.textContent =
                        "Following";

                    profile.followers++;
                }


                updateStats();
            }
        );
    }


    /* =====================================================
       HEATMAP
       ===================================================== */

    function buildHeatmap() {

        const heatmap =
            getElement("heatmap");

        if (!heatmap) {
            return;
        }


        heatmap.innerHTML = "";


        for (let i = 0; i < 140; i++) {

            const cell =
                document.createElement("div");

            cell.className =
                "heatmap-cell";


            const activity =
                Math.floor(
                    Math.random() * 5
                );


            cell.dataset.level =
                activity;


            heatmap.appendChild(
                cell
            );
        }
    }


    /* =====================================================
       INITIAL UI
       ===================================================== */

    updateStats();

    updateProfileCompletion();

    buildHeatmap();

    renderSkills();


    /*
     * Default avatar until backend data arrives.
     */

    updateAvatarInitials(
        "New Scholar"
    );


    /* =====================================================
       FETCH USER DATA ON PAGE LOAD
       ===================================================== */

    console.log(
        "🚀 Initializing Dashboard - calling fetchUserData()"
    );


    fetchUserData();

});