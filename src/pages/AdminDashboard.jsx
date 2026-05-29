import React, { useState, useEffect } from "react";
import {
  getAllStudents,
  deleteStudent,
  addClass,
  getClasses,
  deleteClass,
  getAllPayments,
  approvePayment,
  rejectPayment,
  updateClassFields,
  getStudentPayments,
  getStudentByStudentId,
  activateClassForStudent,
  deactivateClassForStudent,
  updateTuteTracking,
  verifyStudentNIC,
  verifyStudentProfile,
  cleanupExpiredSlips,
  cleanupShippedTutes
} from "../db/firestoreService";
import { Html5Qrcode } from "html5-qrcode";

// ── Hash <-> Tab mapping ─────────────────────────────────────────────
const TAB_HASHES = {
  students:           "#students",
  classes:            "#classes",
  recordings:         "#recordings",
  approvals:          "#approvals",
  tutes:              "#tutes",
  verification:       "#verification",
  studentVerification:"#studentVerification",
};
const HASH_TO_TAB = Object.fromEntries(
  Object.entries(TAB_HASHES).map(([k, v]) => [v, k])
);
const getTabFromHash = () => HASH_TO_TAB[window.location.hash] || "students";

export default function AdminDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState(getTabFromHash);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Data lists
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [payments, setPayments] = useState([]);
  
  // Loading states
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Search filter for students tab
  const [searchQuery, setSearchQuery] = useState("");

  // Search filters for other tabs
  const [tuteSearch, setTuteSearch] = useState("");
  const [svSearch, setSvSearch] = useState("");

  // Tute Delivery filter
  const [tuteFilter, setTuteFilter] = useState("All"); // All | Pending | Shipped | Delivered

  // Student Verification filter
  const [svFilter, setSvFilter] = useState("All"); // All | PendingNIC | PendingProfile | Verified | NoDoc

  // New Class Form State
  const [classForm, setClassForm] = useState({
    title: "",
    price: "",
    month: "June",
    batch: "2026AL",
    description: "",
    type: "chemistry"
  });
  const [addingClassStatus, setAddingClassStatus] = useState("");

  // 🎥 Recordings and Zoom Live Management Tab states
  const [selectedClassId, setSelectedClassId] = useState("");
  const [classDetails, setClassDetails] = useState(null);
  const [videoForm, setVideoForm] = useState({ caption: "", youtubeLink: "" });
  const [zoomForm, setZoomForm] = useState({ zoomLink: "", zoomCaption: "" });
  const [updatingZoomStatus, setUpdatingZoomStatus] = useState("");

  // Modals / Zoom States
  const [viewingStudent, setViewingStudent] = useState(null);
  const [zoomedSlip, setZoomedSlip] = useState(null);
  const [reviewingVerificationStudent, setReviewingVerificationStudent] = useState(null);

  // Tute Delivery Tab states
  const [editingTuteId, setEditingTuteId] = useState(null);
  const [tuteForm, setTuteForm] = useState({ trackingId: "", courierLink: "" });

  // Physical Student Verification Tab states
  const [verificationSearchId, setVerificationSearchId] = useState("");
  const [verifiedStudent, setVerifiedStudent] = useState(null);
  const [studentActiveClasses, setStudentActiveClasses] = useState([]);
  const [searchingStudent, setSearchingStudent] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);

  // Fetch all data
  const fetchData = async () => {
    setLoadingStudents(true);
    setLoadingClasses(true);
    setLoadingPayments(true);
    try {
      const allStuds = await getAllStudents();
      setStudents(allStuds);
      
      const allCls = await getClasses();
      setClasses(allCls);
      
      const allPays = await getAllPayments();
      setPayments(allPays);
    } catch (e) {
      console.error("Error fetching admin dashboard data:", e);
    } finally {
      setLoadingStudents(false);
      setLoadingClasses(false);
      setLoadingPayments(false);
    }
  };

  // ── Hash-based routing: sync URL hash → activeTab ────────────────
  useEffect(() => {
    const onHashChange = () => {
      const tab = getTabFromHash();
      setActiveTab(tab);
    };
    window.addEventListener("hashchange", onHashChange);
    // Set initial hash if missing
    if (!window.location.hash) {
      window.history.replaceState(null, "", `#${activeTab}`);
    }
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    fetchData();
    cleanupExpiredSlips();
    cleanupShippedTutes();
  }, []);

  // Sync selected class details when selectedClassId changes
  useEffect(() => {
    if (selectedClassId) {
      const cls = classes.find(c => c.id === selectedClassId);
      if (cls) {
        setClassDetails(cls);
        setZoomForm({
          zoomLink: cls.zoomLink || "",
          zoomCaption: cls.zoomCaption || ""
        });
      }
    } else {
      setClassDetails(null);
    }
  }, [selectedClassId, classes]);

  // QR Code Scanner effect using direct Html5Qrcode for instant camera open
  useEffect(() => {
    let html5QrCode = null;
    let isMounted = true;

    if (activeTab === "verification" && scannerActive) {
      const qrReaderEl = document.getElementById("qr-reader-el");
      if (qrReaderEl) {
        try {
          html5QrCode = new Html5Qrcode("qr-reader-el");
          html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 }
            },
            (decodedText) => {
              if (!isMounted) return;
              const lines = decodedText.split("\n");
              let foundId = "";
              for (const line of lines) {
                if (line.startsWith("ID:")) {
                  foundId = line.replace("ID:", "").trim();
                  break;
                }
              }
              if (!foundId && decodedText.includes("SK")) {
                const match = decodedText.match(/SK\d+/);
                if (match) foundId = match[0];
              }
              const searchId = foundId || decodedText.trim();
              setVerificationSearchId(searchId);
              handleSearchStudent(searchId);
              setScannerActive(false);
            },
            (err) => {
              // Ignore scan parsing error
            }
          ).catch((err) => {
            console.error("Unable to start scanning.", err);
          });
        } catch (err) {
          console.error("Failed to initialize Html5Qrcode", err);
        }
      }
    }

    return () => {
      isMounted = false;
      if (html5QrCode) {
        // Stop scanning on clean up
        html5QrCode.stop().catch(err => {
          // Ignore error if already stopped or failed to stop
        });
      }
    };
  }, [activeTab, scannerActive]);

  // Delete Student
  const handleDeleteStudent = async (uid) => {
    if (window.confirm("මෙම ශිෂ්‍යයා ඇත්තටම පද්ධතියෙන් ඉවත් කිරීමට අවශ්‍යද?")) {
      try {
        await deleteStudent(uid);
        alert("ශිෂ්‍යයා සාර්ථකව ඉවත් කරන ලදී.");
        fetchData();
      } catch (err) {
        alert("ඉවත් කිරීම අසාර්ථකයි: " + err.message);
      }
    }
  };

  // Add Class
  const handleAddClassSubmit = async (e) => {
    e.preventDefault();
    if (!classForm.title || !classForm.price) {
      alert("කරුණාකර සියලු විස්තර ඇතුළත් කරන්න.");
      return;
    }
    setAddingClassStatus("adding");
    try {
      const payload = {
        ...classForm,
        price: Number(classForm.price),
        videos: [],
        zoomLink: "",
        zoomCaption: ""
      };
      await addClass(payload);
      setAddingClassStatus("success");
      setClassForm({
        title: "",
        price: "",
        month: "June",
        batch: "2026AL",
        description: "",
        type: "chemistry"
      });
      fetchData();
      setTimeout(() => setAddingClassStatus(""), 2000);
    } catch (err) {
      alert("පන්තිය ඇතුළත් කිරීම අසාර්ථකයි: " + err.message);
      setAddingClassStatus("");
    }
  };

  // Delete Class
  const handleDeleteClass = async (classId) => {
    if (window.confirm("මෙම පන්තිය Catalog එකෙන් ඉවත් කිරීමට අවශ්‍යද?")) {
      try {
        await deleteClass(classId);
        alert("පන්තිය සාර්ථකව ඉවත් කරන ලදී.");
        fetchData();
        if (selectedClassId === classId) {
          setSelectedClassId("");
        }
      } catch (err) {
        alert("ඉවත් කිරීම අසාර්ථකයි: " + err.message);
      }
    }
  };

  // Update Zoom Link
  const handleUpdateZoom = async (e) => {
    e.preventDefault();
    if (!selectedClassId) return;
    setUpdatingZoomStatus("updating");
    try {
      await updateClassFields(selectedClassId, {
        zoomLink: zoomForm.zoomLink,
        zoomCaption: zoomForm.zoomCaption
      });
      setUpdatingZoomStatus("success");
      fetchData();
      setTimeout(() => setUpdatingZoomStatus(""), 2000);
    } catch (err) {
      alert("Zoom Link යාවත්කාලීන කිරීම අසාර්ථකයි: " + err.message);
      setUpdatingZoomStatus("");
    }
  };

  // Add Video
  const handleAddVideo = async (e) => {
    e.preventDefault();
    if (!selectedClassId || !videoForm.caption || !videoForm.youtubeLink) return;
    try {
      const currentVideos = classDetails.videos || [];
      const updatedVideos = [...currentVideos, { ...videoForm }];
      await updateClassFields(selectedClassId, { videos: updatedVideos });
      setVideoForm({ caption: "", youtubeLink: "" });
      alert("වීඩියෝව සාර්ථකව එකතු කරන ලදී.");
      fetchData();
    } catch (err) {
      alert("වීඩියෝව එකතු කිරීම අසාර්ථකයි: " + err.message);
    }
  };

  // Delete Video
  const handleDeleteVideo = async (videoIndex) => {
    if (!selectedClassId) return;
    if (window.confirm("මෙම වීඩියෝ දේශනය ඉවත් කිරීමට අවශ්‍යද?")) {
      try {
        const currentVideos = classDetails.videos || [];
        const updatedVideos = currentVideos.filter((_, idx) => idx !== videoIndex);
        await updateClassFields(selectedClassId, { videos: updatedVideos });
        fetchData();
      } catch (err) {
        alert("වීඩියෝව ඉවත් කිරීම අසාර්ථකයි: " + err.message);
      }
    }
  };

  // Approve Payment
  const handleApprovePayment = async (paymentId) => {
    try {
      await approvePayment(paymentId);
      alert("ගෙවීම් රිසිට්පත සාර්ථකව අනුමත කරන ලදී! පන්තිය ශිෂ්‍යයාට විවෘත වේ.");
      fetchData();
    } catch (err) {
      alert("අනුමත කිරීම අසාර්ථකයි: " + err.message);
    }
  };

  // Reject Payment
  const handleRejectPayment = async (paymentId) => {
    if (window.confirm("මෙම ගෙවීම් රිසිට්පත ප්‍රතික්ෂේප කිරීමට අවශ්‍යද?")) {
      try {
        await rejectPayment(paymentId);
        alert("ගෙවීම් රිසිට්පත ප්‍රතික්ෂේප කරන ලදී.");
        fetchData();
      } catch (err) {
        alert("ප්‍රතික්ෂේප කිරීම අසාර්ථකයි: " + err.message);
      }
    }
  };

  // Update Tute Tracking
  const handleUpdateTuteTracking = async (paymentId) => {
    try {
      await updateTuteTracking(paymentId, {
        trackingId: tuteForm.trackingId,
        courierLink: tuteForm.courierLink
      });
      alert("Tracking තොරතුරු යාවත්කාලීන කරන ලදී.");
      setEditingTuteId(null);
      setTuteForm({ trackingId: "", courierLink: "" });
      fetchData();
    } catch (err) {
      alert("යාවත්කාලීන කිරීම අසාර්ථකයි: " + err.message);
    }
  };

  // Change Tute Delivery Status
  const handleTuteStatusChange = async (paymentId, status) => {
    try {
      const updateData = { deliveryStatus: status };
      if (status === "Shipped") {
        updateData.shippedAt = new Date().toISOString();
      } else if (status === "Delivered") {
        updateData.deliveredAt = new Date().toISOString();
      }
      await updateTuteTracking(paymentId, updateData);
      alert(`තත්ත්වය ${status} ලෙස සාර්ථකව වෙනස් කරන ලදී.`);
      fetchData();
    } catch (err) {
      alert("තත්ත්වය වෙනස් කිරීම අසාර්ථකයි: " + err.message);
    }
  };

  // Search student in Physical verification tab
  const handleSearchStudent = async (sid) => {
    const cleanId = sid || verificationSearchId;
    if (!cleanId) return;
    setSearchingStudent(true);
    setVerifiedStudent(null);
    setStudentActiveClasses([]);
    try {
      const student = await getStudentByStudentId(cleanId);
      if (student) {
        setVerifiedStudent(student);
        const paymentsLog = await getStudentPayments(student.id);
        const activeIds = paymentsLog
          .filter(p => p.status === "approved")
          .map(p => p.classId);
        setStudentActiveClasses(activeIds);
      } else {
        alert("මෙම ID එක සහිත ශිෂ්‍යයෙකු සොයාගත නොහැකි විය.");
      }
    } catch (e) {
      console.error(e);
      alert("සෙවීම අසාර්ථකයි.");
    } finally {
      setSearchingStudent(false);
    }
  };

  // Toggle physical class activation
  const handleTogglePhysicalClass = async (classItem, isCurrentlyActive) => {
    if (!verifiedStudent) return;
    try {
      if (isCurrentlyActive) {
        if (window.confirm(`මෙම ශිෂ්‍යයාට ${classItem.title} පන්තිය අත්හිටුවීමට අවශ්‍යද?`)) {
          await deactivateClassForStudent(verifiedStudent.id, classItem.id);
          setStudentActiveClasses(prev => prev.filter(id => id !== classItem.id));
          alert("පන්තිය අත්හිටුවන ලදී.");
          fetchData();
        }
      } else {
        await activateClassForStudent(
          verifiedStudent.id,
          `${verifiedStudent.firstName} ${verifiedStudent.lastName}`,
          verifiedStudent.studentId,
          classItem.id,
          classItem.title,
          classItem.price
        );
        setStudentActiveClasses(prev => [...prev, classItem.id]);
        alert("පන්තිය සක්‍රීය කරන ලදී.");
        fetchData();
      }
    } catch (e) {
      console.error(e);
      alert("ක්‍රියාවලිය අසාර්ථකයි.");
    }
  };

  // Verify Student NIC
  const handleVerifyStudentNIC = async (studentId) => {
    try {
      await verifyStudentNIC(studentId);
      alert("ශිෂ්‍යයාගේ NIC එක සාර්ථකව verify කරන ලදී! පින්තූර ස්වයංක්‍රීයව මකා දමන ලදි.");
      fetchData();
      // Update local modal state if open
      setReviewingVerificationStudent(prev => prev ? { ...prev, isNICVerified: true, nicFrontImage: "", nicBackImage: "" } : null);
    } catch (err) {
      alert("NIC verify කිරීම අසාර්ථකයි: " + err.message);
    }
  };

  // Verify Student Profile
  const handleVerifyStudentProfile = async (studentId) => {
    try {
      await verifyStudentProfile(studentId);
      alert("ශිෂ්‍යයාගේ Profile එක සාර්ථකව verify කරන ලදී!");
      fetchData();
      // Update local modal state if open
      setReviewingVerificationStudent(prev => prev ? { ...prev, isProfileVerified: true } : null);
    } catch (err) {
      alert("Profile verify කිරීම අසාර්ථකයි: " + err.message);
    }
  };

  // Filter students by search query
  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      (s.firstName || "").toLowerCase().includes(q) ||
      (s.lastName || "").toLowerCase().includes(q) ||
      (s.studentId || "").toLowerCase().includes(q) ||
      (s.mobile || "").toLowerCase().includes(q) ||
      (s.school || "").toLowerCase().includes(q)
    );
  });

  // Tute Deliveries List (all)
  const tuteDeliveries = payments.filter(p => p.status === "approved" && p.tuteRequired);

  // Tute Deliveries filtered by tuteFilter and search query (matches ID, name, or looked-up email)
  const filteredTuteDeliveries = tuteDeliveries.filter(d => {
    // Status filter first
    let statusMatch = true;
    if (tuteFilter === "Pending") statusMatch = !d.deliveryStatus || d.deliveryStatus === "Pending";
    else if (tuteFilter === "Shipped") statusMatch = d.deliveryStatus === "Shipped";
    else if (tuteFilter === "Delivered") statusMatch = d.deliveryStatus === "Delivered";

    if (!statusMatch) return false;

    // Search query filter
    const q = tuteSearch.trim().toLowerCase();
    if (!q) return true;

    const student = students.find(s => s.id === d.studentUid || s.studentId === d.studentId);
    const email = student ? (student.email || "").toLowerCase() : "";
    const studentId = (d.studentId || "").toLowerCase();
    const studentName = (d.studentName || "").toLowerCase();

    return studentId.includes(q) || email.includes(q) || studentName.includes(q);
  });

  // Student Verification filtered list (matches ID, email, or name)
  const filteredSVStudents = students.filter(s => {
    // Status filter first
    let statusMatch = true;
    if (svFilter === "PendingNIC") statusMatch = !s.isNICVerified && s.nicFrontImage;
    else if (svFilter === "PendingProfile") statusMatch = !s.isProfileVerified && s.profileImage;
    else if (svFilter === "Verified") statusMatch = s.isNICVerified && s.isProfileVerified;
    else if (svFilter === "NoDoc") statusMatch = !s.nicFrontImage && !s.profileImage;

    if (!statusMatch) return false;

    // Search query filter
    const q = svSearch.trim().toLowerCase();
    if (!q) return true;

    const studentId = (s.studentId || "").toLowerCase();
    const email = (s.email || "").toLowerCase();
    const firstName = (s.firstName || "").toLowerCase();
    const lastName = (s.lastName || "").toLowerCase();

    return studentId.includes(q) || email.includes(q) || firstName.includes(q) || lastName.includes(q);
  });

  // Analytics Stats
  const activeStudentsCount = students.length;
  const pendingPayments = payments.filter((p) => p.status === "pending");
  const pendingPaymentsCount = pendingPayments.length;
  const totalClassesCount = classes.length;
  const pendingTutesCount = tuteDeliveries.filter(d => d.deliveryStatus === "Pending" || !d.deliveryStatus).length;

  const handleTabSelect = (tab) => {
    // Push to history so Back/Forward work
    window.location.hash = TAB_HASHES[tab];
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-750 flex relative font-sans">
      
      {/* ── Left Sidebar (Desktop) / Sliding Panel (Mobile) ── */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 text-slate-700 flex flex-col justify-between transition-transform duration-300 transform lg:translate-x-0 lg:static lg:h-screen ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        
        {/* Brand/Logo */}
        <div>
          <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-200 bg-slate-50/50">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-purple-200">
              <span className="text-white font-black text-base">A</span>
            </div>
            <span className="font-black text-sm tracking-widest text-slate-800">ADMIN CONTROL</span>
          </div>

          {/* Menu Items */}
          <nav className="p-4 space-y-1.5 overflow-y-auto max-h-[calc(100vh-180px)]">
            {/* Students Management */}
            <button
              onClick={() => handleTabSelect("students")}
              className={`w-full py-3 px-4 font-bold text-xs rounded-xl flex items-center gap-3 transition-all cursor-pointer ${
                activeTab === "students" ? "bg-purple-600 text-white shadow-lg shadow-purple-200" : "text-slate-650 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              Students Management
            </button>

            {/* Add & Manage Classes */}
            <button
              onClick={() => handleTabSelect("classes")}
              className={`w-full py-3 px-4 font-bold text-xs rounded-xl flex items-center gap-3 transition-all cursor-pointer ${
                activeTab === "classes" ? "bg-purple-600 text-white shadow-lg shadow-purple-200" : "text-slate-650 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              Add &amp; Manage Classes
            </button>

            {/* Record Upload & Zoom Live */}
            <button
              onClick={() => handleTabSelect("recordings")}
              className={`w-full py-3 px-4 font-bold text-xs rounded-xl flex items-center gap-3 transition-all cursor-pointer ${
                activeTab === "recordings" ? "bg-purple-600 text-white shadow-lg shadow-purple-200" : "text-slate-650 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              🎥 Record Upload &amp; Zoom
            </button>

            {/* Approve Slip Payments */}
            <button
              onClick={() => handleTabSelect("approvals")}
              className={`w-full py-3 px-4 font-bold text-xs rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                activeTab === "approvals" ? "bg-purple-600 text-white shadow-lg shadow-purple-200" : "text-slate-650 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span className="flex items-center gap-3">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                Approve Slip Payments
              </span>
              {pendingPaymentsCount > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm shadow-red-200">
                  {pendingPaymentsCount}
                </span>
              )}
            </button>

            {/* Tute Delivery */}
            <button
              onClick={() => handleTabSelect("tutes")}
              className={`w-full py-3 px-4 font-bold text-xs rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                activeTab === "tutes" ? "bg-purple-600 text-white shadow-lg shadow-purple-200" : "text-slate-650 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span className="flex items-center gap-3">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" /></svg>
                Tute Delivery
              </span>
              {pendingTutesCount > 0 && (
                <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm shadow-amber-250">
                  {pendingTutesCount}
                </span>
              )}
            </button>

            {/* Physical Student Verification */}
            <button
              onClick={() => handleTabSelect("verification")}
              className={`w-full py-3 px-4 font-bold text-xs rounded-xl flex items-center gap-3 transition-all cursor-pointer ${
                activeTab === "verification" ? "bg-purple-600 text-white shadow-lg shadow-purple-200" : "text-slate-650 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0a8 8 0 11-16 0 8 8 0 0116 0z" /></svg>
              Student QR Verification
            </button>

            {/* Online Student Verification */}
            <button
              onClick={() => handleTabSelect("studentVerification")}
              className={`w-full py-3 px-4 font-bold text-xs rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                activeTab === "studentVerification" ? "bg-purple-600 text-white shadow-lg shadow-purple-200" : "text-slate-650 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span className="flex items-center gap-3">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                Student Verification
              </span>
              {students.filter(s => (!s.isProfileVerified || !s.isNICVerified) && (s.profileImage || s.nicFrontImage)).length > 0 && (
                <span className="bg-red-650 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm ml-auto">
                  {students.filter(s => (!s.isProfileVerified || !s.isNICVerified) && (s.profileImage || s.nicFrontImage)).length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Bottom Profile / Logout */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 font-extrabold flex items-center justify-center text-sm shadow-sm border border-purple-200">
              AD
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-slate-850 truncate">System Admin</p>
              <p className="text-[10px] text-slate-500 truncate">skchem.com</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-650 font-extrabold text-xs rounded-xl transition-all border border-red-200 shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Backdrop for Mobile Sidebar */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/45 backdrop-blur-sm z-30 lg:hidden" />
      )}

      {/* ── Right Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm shadow-slate-100">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 lg:hidden cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h2 className="font-extrabold text-slate-850 text-base leading-none">SKCHEM.COM — Admin Control Panel</h2>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchData}
              className="px-3.5 py-2 text-xs font-bold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 transition-all rounded-xl border border-purple-200 shadow-sm flex items-center gap-1.5 cursor-pointer animate-fade-in"
              title="Refresh Database (දත්ත යාවත්කාලීන කරන්න)"
            >
              <svg className="w-4 h-4 text-purple-600 transition-transform duration-500 hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18" />
              </svg>
              Refresh Data
            </button>
            <span className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full font-bold text-[10px] tracking-wide shadow-sm flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-ping" />
              ACTIVE SESSION
            </span>
          </div>
        </header>

        {/* Main View Container */}
        <main className="p-6 md:p-8 space-y-8 flex-grow">
          
          {/* Analytics Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {/* Total Students */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
              <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Students</p>
                <p className="text-slate-900 text-2xl font-black mt-1">{activeStudentsCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
            </div>

            {/* Pending Slips */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
              <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Pending Slips</p>
                <p className={`text-2xl font-black mt-1 ${pendingPaymentsCount > 0 ? "text-red-650" : "text-slate-900"}`}>
                  {pendingPaymentsCount}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                pendingPaymentsCount > 0 ? "bg-red-50 text-red-600 border-red-100" : "bg-slate-50 text-slate-400 border-slate-150"
              }`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </div>
            </div>

            {/* Total Classes */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
              <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Classes</p>
                <p className="text-slate-900 text-2xl font-black mt-1">{totalClassesCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </div>
            </div>

            {/* Pending Tutes */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
              <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Pending Tutes</p>
                <p className={`text-2xl font-black mt-1 ${pendingTutesCount > 0 ? "text-amber-600 font-bold" : "text-slate-900"}`}>
                  {pendingTutesCount}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                pendingTutesCount > 0 ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-slate-50 text-slate-400 border-slate-150"
              }`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" /></svg>
              </div>
            </div>
          </div>

          {/* ──────────────────────────────────────────────────────── */}
          {/* 1. STUDENTS MANAGEMENT TAB                               */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === "students" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              
              {/* Header and filter bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Students Database Management</h3>
                  <p className="text-slate-550 text-xs mt-0.5">පද්ධතියේ ලියාපදිංචි වී ඇති සමස්ත ශිෂ්‍ය තොරතුරු මෙතැනින් පාලනය කරන්න.</p>
                </div>
                <div className="w-full md:max-w-xs relative">
                  <input
                    type="text"
                    placeholder="Search by ID, name, batch, mobile..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all shadow-inner"
                  />
                  <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
              </div>

              {loadingStudents ? (
                <div className="flex justify-center p-12">
                  <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs bg-slate-50 border border-slate-150 rounded-2xl p-8">
                  ලියාපදිංචි ශිෂ්‍යයින් කිසිවෙකු සොයාගත නොහැක!
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-750">
                      <thead className="bg-slate-50 border-b border-slate-200 font-extrabold text-[10px] uppercase text-slate-500 tracking-wider">
                        <tr>
                          <th className="py-4 px-6">Student ID</th>
                          <th className="py-4 px-6">Name</th>
                          <th className="py-4 px-6">AL Batch</th>
                          <th className="py-4 px-6">Mobile</th>
                          <th className="py-4 px-6">City</th>
                          <th className="py-4 px-6 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {filteredStudents.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-6 font-bold text-purple-650 font-mono tracking-wider">{s.studentId || "N/A"}</td>
                            <td className="py-4 px-6 font-semibold text-slate-800">{s.firstName} {s.lastName}</td>
                            <td className="py-4 px-6">
                              <span className="px-2.5 py-0.5 bg-slate-100 text-slate-650 text-[9px] font-bold rounded uppercase border border-slate-200">
                                {s.batch}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-slate-500 font-mono">{s.mobile}</td>
                            <td className="py-4 px-6 text-slate-500">{s.homeCity}</td>
                            <td className="py-4 px-6 flex items-center justify-center gap-2">
                              <button
                                onClick={() => setViewingStudent(s)}
                                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-650 font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                Profile
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(s.id)}
                                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-650 font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* 2. ADD & MANAGE CLASSES TAB                              */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === "classes" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Class Creator Form */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit">
                <h3 className="font-extrabold text-slate-850 text-base border-b border-slate-200 pb-3 mb-4">Add New Class Catalog</h3>
                <form onSubmit={handleAddClassSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Class Title</label>
                    <input
                      type="text"
                      placeholder="2026 Revision Only | June"
                      value={classForm.title}
                      onChange={(e) => setClassForm({ ...classForm, title: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Price (LKR)</label>
                    <input
                      type="number"
                      placeholder="3300"
                      value={classForm.price}
                      onChange={(e) => setClassForm({ ...classForm, price: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Target Month</label>
                    <select
                      value={classForm.month}
                      onChange={(e) => setClassForm({ ...classForm, month: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    >
                      {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">AL Batch Compatibility</label>
                    <select
                      value={classForm.batch}
                      onChange={(e) => setClassForm({ ...classForm, batch: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    >
                      <option value="2026AL">2026 A/L</option>
                      <option value="2027AL">2027 A/L</option>
                      <option value="2028AL">2028 A/L</option>
                      <option value="2026Rapid">2026 Rapid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description (Optional)</label>
                    <textarea
                      placeholder="Class objectives, details..."
                      value={classForm.description}
                      onChange={(e) => setClassForm({ ...classForm, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={addingClassStatus === "adding"}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-2.5 rounded-lg text-xs transition-colors shadow-lg shadow-purple-200 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {addingClassStatus === "adding" ? "Creating..." : "Add Class to Catalog"}
                  </button>
                  {addingClassStatus === "success" && (
                    <p className="text-center text-green-600 text-xs font-bold mt-2">Class added successfully! 🎉</p>
                  )}
                </form>
              </div>

              {/* Class Catalog List */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-extrabold text-slate-850 text-base border-b border-slate-200 pb-3 mb-4">Classes Package List ({classes.length})</h3>

                {loadingClasses ? (
                  <div className="flex justify-center p-12">
                    <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : classes.length === 0 ? (
                  <p className="text-center py-12 text-slate-400 text-xs font-semibold">තවමත් කිසිදු පන්තියක් එකතු කර නැත.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {classes.map((cls) => (
                      <div
                        key={cls.id}
                        className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden"
                      >
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-start gap-3">
                            <h4 className="font-extrabold text-slate-800 text-sm leading-snug">{cls.title}</h4>
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[8px] font-black rounded border border-purple-200 uppercase flex-shrink-0">
                              {cls.batch}
                            </span>
                          </div>
                          <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed">{cls.description || "විස්තර කිසිවක් නැත."}</p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Price</span>
                            <p className="text-purple-750 font-black text-sm leading-none mt-0.5">LKR {cls.price}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteClass(cls.id)}
                            className="py-1 px-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-650 font-extrabold text-[10px] rounded-lg shadow-sm transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* 3. RECORDING UPLOAD & ZOOM TAB                           */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === "recordings" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Selector Column */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit space-y-4">
                <div>
                  <h3 className="font-extrabold text-slate-850 text-base">Select Class</h3>
                  <p className="text-slate-500 text-[11px] mt-0.5">දේශන සහ Zoom සබැඳි එක් කිරීමට පන්තියක් තෝරන්න.</p>
                </div>
                
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {classes.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => setSelectedClassId(cls.id)}
                      className={`w-full text-left p-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex justify-between items-center ${
                        selectedClassId === cls.id
                          ? "bg-purple-600 text-white border-purple-700 shadow-md shadow-purple-200"
                          : "bg-slate-50 border-slate-200 text-slate-750 hover:bg-slate-100"
                      }`}
                    >
                      <span className="truncate pr-2">{cls.title}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                        selectedClassId === cls.id ? "bg-purple-700 text-purple-100" : "bg-slate-200 text-slate-650"
                      }`}>
                        {cls.month}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Middle & Right Main Workspace */}
              <div className="lg:col-span-2 space-y-6">
                {classDetails ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Zoom Live link updater */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 h-fit">
                      <div>
                        <h4 className="font-extrabold text-slate-850 text-sm">Zoom Live Link</h4>
                        <p className="text-slate-500 text-[10px] mt-0.5">මෙම පන්තියේ ඊළඟ සජීවී Zoom සබැඳිය මෙතැනින් යාවත්කාලීන කරන්න.</p>
                      </div>

                      <form onSubmit={handleUpdateZoom} className="space-y-3.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Zoom Invitation Link</label>
                          <input
                            type="url"
                            placeholder="https://zoom.us/j/..."
                            value={zoomForm.zoomLink}
                            onChange={(e) => setZoomForm({ ...zoomForm, zoomLink: e.target.value })}
                            required
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Zoom Caption / Date</label>
                          <input
                            type="text"
                            placeholder="Tonight @ 8.30 PM"
                            value={zoomForm.zoomCaption}
                            onChange={(e) => setZoomForm({ ...zoomForm, zoomCaption: e.target.value })}
                            required
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={updatingZoomStatus === "updating"}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-2 rounded-lg text-xs transition-colors shadow-md shadow-purple-200 cursor-pointer"
                        >
                          {updatingZoomStatus === "updating" ? "Saving Link..." : "Update Zoom Link"}
                        </button>
                        {updatingZoomStatus === "success" && (
                          <p className="text-center text-green-600 text-[10px] font-bold mt-1">Zoom details updated! 🚀</p>
                        )}
                      </form>
                    </div>

                    {/* Recordings videos manager */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                      <div>
                        <h4 className="font-extrabold text-slate-850 text-sm">Lecture Recordings</h4>
                        <p className="text-slate-500 text-[10px] mt-0.5">පටිගත කළ දේශන වීඩියෝ මෙම පන්තියට එකතු කරන්න.</p>
                      </div>

                      <form onSubmit={handleAddVideo} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                        <p className="font-bold text-slate-700 text-xs">Add New Video</p>
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Video Title (e.g. Session 01 — Organic)"
                            value={videoForm.caption}
                            onChange={(e) => setVideoForm({ ...videoForm, caption: e.target.value })}
                            required
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          />
                          <input
                            type="text"
                            placeholder="YouTube Video URL / Share Link"
                            value={videoForm.youtubeLink}
                            onChange={(e) => setVideoForm({ ...videoForm, youtubeLink: e.target.value })}
                            required
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full bg-purple-650 hover:bg-purple-750 text-white font-extrabold py-2 rounded-lg text-xs transition-colors shadow-sm cursor-pointer"
                        >
                          Add Video
                        </button>
                      </form>

                      {/* Existing Videos List */}
                      <div className="space-y-2">
                        <p className="font-bold text-slate-650 text-xs">Videos List ({classDetails.videos?.length || 0})</p>
                        {(!classDetails.videos || classDetails.videos.length === 0) ? (
                          <p className="text-slate-400 text-xs">මෙම පන්තියට තවමත් වීඩියෝ කිසිවක් එකතු කර නැත.</p>
                        ) : (
                          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50">
                            {classDetails.videos.map((vid, index) => (
                              <div key={index} className="p-3 flex items-center justify-between gap-4 text-xs">
                                <div className="truncate">
                                  <p className="font-bold text-slate-800 truncate">{vid.caption}</p>
                                  <p className="text-[10px] text-slate-500 font-mono truncate">{vid.youtubeLink}</p>
                                </div>
                                <button
                                  onClick={() => handleDeleteVideo(index)}
                                  className="text-red-600 hover:text-red-750 font-bold text-[11px] flex-shrink-0 cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-450 text-xs">
                    කරුණාකර වම් පසින් පන්තියක් තෝරාගන්න.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* 4. APPROVE SLIP PAYMENTS TAB                             */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === "approvals" && (
            <div className="space-y-6">
              <h2 className="text-lg font-extrabold text-slate-900">Pending Slip Payments Approval</h2>

              {loadingPayments ? (
                <div className="flex justify-center p-12">
                  <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : pendingPayments.length === 0 ? (
                <div className="text-center py-12 text-slate-450 text-xs bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                  අනුමත කිරීමට බලාපොරොත්තුවෙන් පවතින ගෙවීම් රිසිට්පත් කිසිවක් නැත!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pendingPayments.map((pay) => (
                    <div key={pay.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all hover:shadow-md">
                      <div>
                        {/* Slip preview */}
                        <div
                          onClick={() => setZoomedSlip(pay.slipImage)}
                          className="h-44 bg-slate-100 flex items-center justify-center overflow-hidden cursor-zoom-in relative border-b border-slate-200"
                        >
                          {pay.slipImage.startsWith("data:application/pdf;base64,") ? (
                            <div className="flex flex-col items-center gap-2 text-slate-555 select-none animate-fade-in">
                              <svg className="w-12 h-12 text-red-600 drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="text-[10px] font-extrabold text-slate-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">PDF Document</span>
                            </div>
                          ) : (
                            <img
                              src={pay.slipImage}
                              alt="Slip"
                              className="h-full w-full object-contain hover:scale-105 transition-transform"
                            />
                          )}
                          <span className="absolute bottom-3 right-3 bg-black/60 text-white text-[9px] font-bold py-1 px-2 rounded-full backdrop-blur-sm shadow">
                            🔍 Click to zoom
                          </span>
                        </div>

                        {/* Payment Details */}
                        <div className="p-4 space-y-3">
                          <div>
                            <p className="text-[9px] font-bold text-purple-650 uppercase tracking-widest font-mono">
                              ID: {pay.studentId}
                            </p>
                            <h4 className="font-extrabold text-slate-800 text-sm mt-0.5">{pay.studentName}</h4>
                          </div>

                          <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 text-[11px] space-y-1.5 shadow-inner">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Class:</span>
                              <span className="font-bold text-slate-750">{pay.classTitle}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Amount:</span>
                              <span className="font-bold text-slate-750">LKR {pay.price}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Date:</span>
                              <span className="text-slate-650 font-mono">
                                {pay.submittedAt ? new Date(pay.submittedAt).toLocaleString() : "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Approval Controls */}
                      <div className="p-4 pt-0 flex gap-2">
                        <button
                          onClick={() => handleRejectPayment(pay.id)}
                          className="flex-1 py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-650 font-extrabold text-xs rounded-lg transition-colors border border-red-200 cursor-pointer shadow-sm"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApprovePayment(pay.id)}
                          className="flex-1 py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white font-extrabold text-xs rounded-lg shadow-md shadow-green-200 transition-colors cursor-pointer"
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* 5. TUTE DELIVERY TAB                                     */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === "tutes" && (
            <div className="space-y-6">
              {/* Header + Filter Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Tute Delivery Tracking System</h2>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Shipped ලෙස සකසා දින 14කින් records ස්වයංක්‍රීයව Delete වේ.
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Search Bar */}
                  <div className="relative max-w-xs w-full min-w-[200px]">
                    <input
                      type="text"
                      placeholder="Search by ID or Email..."
                      value={tuteSearch}
                      onChange={(e) => setTuteSearch(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all shadow-inner"
                    />
                    <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {["All", "Pending", "Shipped", "Delivered"].map(f => {
                      const counts = {
                        All: tuteDeliveries.length,
                        Pending: tuteDeliveries.filter(d => !d.deliveryStatus || d.deliveryStatus === "Pending").length,
                        Shipped: tuteDeliveries.filter(d => d.deliveryStatus === "Shipped").length,
                        Delivered: tuteDeliveries.filter(d => d.deliveryStatus === "Delivered").length,
                      };
                      const colors = {
                        All: tuteFilter === f ? "bg-purple-600 text-white border-purple-700 shadow-md shadow-purple-100" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
                        Pending: tuteFilter === f ? "bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-100" : "bg-white text-amber-700 border-amber-200 hover:bg-amber-50",
                        Shipped: tuteFilter === f ? "bg-blue-600 text-white border-blue-700 shadow-md shadow-blue-100" : "bg-white text-blue-700 border-blue-200 hover:bg-blue-50",
                        Delivered: tuteFilter === f ? "bg-green-600 text-white border-green-700 shadow-md shadow-green-100" : "bg-white text-green-700 border-green-200 hover:bg-green-50",
                      };
                      return (
                        <button
                          key={f}
                          onClick={() => setTuteFilter(f)}
                          className={`px-3 py-1.5 rounded-xl border font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${colors[f]}`}
                        >
                          {f}
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                            tuteFilter === f ? "bg-white/25" : "bg-slate-100 text-slate-500"
                          }`}>
                            {counts[f]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {loadingPayments ? (
                <div className="flex justify-center p-12">
                  <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredTuteDeliveries.length === 0 ? (
                <div className="text-center py-12 text-slate-450 text-xs bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                  {tuteFilter === "All"
                    ? "නිබන්ධන තැපැල් කිරීමේ ඉල්ලීම් කිසිවක් දැනට නොමැත."
                    : `"${tuteFilter}" status එකේ tute delivery records නොමැත.`}
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-750">
                      <thead className="bg-slate-50 border-b border-slate-200 font-extrabold text-[10px] uppercase text-slate-500 tracking-wider">
                        <tr>
                          <th className="py-4 px-6">Student</th>
                          <th className="py-4 px-6">Tute / Class</th>
                          <th className="py-4 px-6">Delivery Address</th>
                          <th className="py-4 px-6">Tracking Details</th>
                          <th className="py-4 px-6">Status</th>
                          <th className="py-4 px-6 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {filteredTuteDeliveries.map((delivery) => (
                          <tr key={delivery.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-6">
                              <p className="font-bold text-slate-850">{delivery.studentName}</p>
                              <p className="text-[10px] text-slate-500 font-mono">ID: {delivery.studentId}</p>
                              <p className="text-[10px] text-slate-500 font-mono">Tel: {delivery.deliveryPhone || "N/A"}</p>
                            </td>
                            <td className="py-4 px-6">
                              <p className="font-bold text-slate-700">{delivery.classTitle}</p>
                            </td>
                            <td className="py-4 px-6">
                              <p className="max-w-xs break-words text-slate-600 font-medium">{delivery.deliveryAddress || "N/A"}</p>
                            </td>
                            <td className="py-4 px-6 space-y-1">
                              {editingTuteId === delivery.id ? (
                                <div className="space-y-1.5 max-w-xs">
                                  <input
                                    type="text"
                                    placeholder="Tracking ID"
                                    value={tuteForm.trackingId}
                                    onChange={(e) => setTuteForm({ ...tuteForm, trackingId: e.target.value })}
                                    className="px-2.5 py-1.5 border border-slate-200 bg-white text-slate-800 rounded-lg w-full text-[11px] focus:outline-none focus:ring-1 focus:ring-purple-500"
                                  />
                                  <input
                                    type="url"
                                    placeholder="Courier URL"
                                    value={tuteForm.courierLink}
                                    onChange={(e) => setTuteForm({ ...tuteForm, courierLink: e.target.value })}
                                    className="px-2.5 py-1.5 border border-slate-200 bg-white text-slate-800 rounded-lg w-full text-[11px] focus:outline-none focus:ring-1 focus:ring-purple-500"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleUpdateTuteTracking(delivery.id)}
                                      className="px-2.5 py-1 bg-purple-600 text-white font-bold rounded text-[10px] cursor-pointer"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingTuteId(null)}
                                      className="px-2.5 py-1 bg-slate-100 text-slate-500 font-bold rounded text-[10px] cursor-pointer border border-slate-200"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p>
                                    ID:{" "}
                                    <span className="font-bold text-purple-650 font-mono">
                                      {delivery.trackingId || "None"}
                                    </span>
                                  </p>
                                  {delivery.courierLink && (
                                    <a
                                      href={delivery.courierLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline text-[10px] block"
                                    >
                                      Link to Courier
                                    </a>
                                  )}
                                  <button
                                    onClick={() => {
                                      setEditingTuteId(delivery.id);
                                      setTuteForm({
                                        trackingId: delivery.trackingId || "",
                                        courierLink: delivery.courierLink || ""
                                      });
                                    }}
                                    className="text-[10px] text-purple-650 hover:text-purple-800 font-bold cursor-pointer bg-transparent border-0"
                                  >
                                    Edit Details
                                  </button>
                                </>
                              )}
                            </td>
                            <td className="py-4 px-6">
                              {delivery.deliveryStatus === "Delivered" ? (
                                <span className="px-2.5 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full font-bold text-[9px] uppercase shadow-sm">
                                  Delivered
                                </span>
                              ) : delivery.deliveryStatus === "Shipped" ? (
                                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-bold text-[9px] uppercase shadow-sm">
                                  Shipped
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold text-[9px] uppercase shadow-sm">
                                  Pending
                                </span>
                              )}
                              {delivery.studentConfirmed && (
                                <p className="text-[10px] text-green-600 font-extrabold mt-1">✓ Received By Student</p>
                              )}
                            </td>
                            <td className="py-4 px-6 text-center space-y-1.5">
                              <button
                                onClick={() => handleTuteStatusChange(delivery.id, "Shipped")}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 text-[10px] font-bold w-24 cursor-pointer shadow-sm"
                              >
                                Shipped
                              </button>
                              <br />
                              <button
                                onClick={() => handleTuteStatusChange(delivery.id, "Delivered")}
                                className="px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded border border-green-200 text-[10px] font-bold w-24 cursor-pointer shadow-sm"
                              >
                                Delivered
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* 6. PHYSICAL STUDENT VERIFICATION TAB                      */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === "verification" && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Physical Student Verification</h2>
                  <p className="text-slate-500 text-xs">QR කේතය ස්කෑන් කිරීමෙන් හෝ ශිෂ්‍ය හැඳුනුම්පත (Student ID) ඇතුළත් කිරීමෙන් ශිෂ්‍යයා සොයා පන්ති සක්‍රීය කරන්න.</p>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 max-w-sm">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Enter Student ID</label>
                    <input
                      type="text"
                      placeholder="e.g. SK123456"
                      value={verificationSearchId}
                      onChange={(e) => setVerificationSearchId(e.target.value.toUpperCase())}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all shadow-inner"
                    />
                  </div>
                  <button
                    onClick={() => handleSearchStudent()}
                    disabled={searchingStudent || !verificationSearchId}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-md shadow-purple-200 cursor-pointer disabled:opacity-50"
                  >
                    {searchingStudent ? "Searching..." : "Search Student"}
                  </button>
                  <button
                    onClick={() => {
                      setScannerActive(!scannerActive);
                      setVerifiedStudent(null);
                    }}
                    className={`font-extrabold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer ${
                      scannerActive 
                        ? "bg-red-650 hover:bg-red-700 text-white shadow-red-200" 
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-250 shadow-slate-100"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0a8 8 0 11-16 0 8 8 0 0116 0z" /></svg>
                    {scannerActive ? "Stop Camera" : "Scan Student QR"}
                  </button>
                </div>

                {/* QR Reader Element - Direct camera access without ugly buttons */}
                {scannerActive && (
                  <div className="max-w-md mx-auto border border-slate-200 rounded-2xl overflow-hidden p-4 bg-slate-50 shadow-md space-y-3">
                    <p className="text-center font-bold text-red-650 text-[10px] animate-pulse tracking-widest">📷 CAMERA SCANNING ACTIVE</p>
                    <div id="qr-reader-el" className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-inner" />
                  </div>
                )}
              </div>

              {/* Student details & class activator */}
              {verifiedStudent && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Student Details Card */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit space-y-4">
                    <div className="border-b border-slate-200 pb-3 flex items-center gap-3">
                      {verifiedStudent.profileImage ? (
                        <img
                          src={verifiedStudent.profileImage}
                          alt="Profile"
                          className="w-14 h-14 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-purple-50 border border-purple-200 text-purple-650 font-extrabold flex items-center justify-center text-lg shadow-sm">
                          {verifiedStudent.firstName?.[0]}{verifiedStudent.lastName?.[0]}
                        </div>
                      )}
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-sm">
                          {verifiedStudent.firstName} {verifiedStudent.lastName}
                        </h4>
                        <p className="text-[10px] text-slate-500">{verifiedStudent.email}</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-400">Student ID:</span>
                        <span className="font-bold text-purple-650 font-mono tracking-wider">
                          {verifiedStudent.studentId || "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-400">Batch:</span>
                        <span className="font-bold text-slate-700">{verifiedStudent.batch || "N/A"}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-400">Mobile:</span>
                        <span className="font-bold text-slate-700 font-mono">{verifiedStudent.mobile || "N/A"}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-400">NIC:</span>
                        <span className="font-bold text-slate-700 font-mono">{verifiedStudent.nic || "N/A"}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-400">Home City:</span>
                        <span className="font-bold text-slate-700">{verifiedStudent.homeCity || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Classes Activator Card */}
                  <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <h3 className="font-extrabold text-slate-850 text-base border-b border-slate-200 pb-3">Activate Class Packages for Student</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {classes.map(c => {
                        const isCurrentlyActive = studentActiveClasses.includes(c.id);
                        return (
                          <div
                            key={c.id}
                            className={`p-4 border rounded-xl flex items-center justify-between gap-4 transition-all ${
                              isCurrentlyActive ? "bg-green-50/50 border-green-200" : "bg-slate-50 border-slate-200 hover:bg-slate-100/55"
                            }`}
                          >
                            <div>
                              <p className="font-bold text-slate-850 text-xs">{c.title}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">Month: {c.month} | Price: LKR {c.price}</p>
                            </div>
                            <button
                              onClick={() => handleTogglePhysicalClass(c, isCurrentlyActive)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition-all cursor-pointer ${
                                isCurrentlyActive
                                  ? "bg-red-50 hover:bg-red-100 border border-red-200 text-red-650"
                                  : "bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-100"
                              }`}
                            >
                              {isCurrentlyActive ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* 6.5. ONLINE STUDENT VERIFICATION TAB                     */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === "studentVerification" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              {/* Header + Filter Bar */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Online Student Account Verification</h3>
                  <p className="text-slate-550 text-xs mt-0.5">ශිෂ්‍යයන් විසින් ඉදිරිපත් කරන ලද profile ඡායාරූප සහ NIC ඡායාරූප පරීක්ෂා කර ගිණුම් සක්‍රීය (verify) කරන්න.</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap shrink-0">
                  {/* Search Bar */}
                  <div className="relative max-w-xs w-full min-w-[200px]">
                    <input
                      type="text"
                      placeholder="Search by ID or Email..."
                      value={svSearch}
                      onChange={(e) => setSvSearch(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-805 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all shadow-inner"
                    />
                    <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {[
                      { key: "All",            label: "All",             color: "purple" },
                      { key: "PendingNIC",     label: "Pending NIC",     color: "amber"  },
                      { key: "PendingProfile", label: "Pending Profile", color: "orange" },
                      { key: "Verified",       label: "Verified",        color: "green"  },
                      { key: "NoDoc",          label: "No Docs",         color: "slate"  },
                    ].map(f => {
                      const countMap = {
                        All:            students.length,
                        PendingNIC:     students.filter(s => !s.isNICVerified && s.nicFrontImage).length,
                        PendingProfile: students.filter(s => !s.isProfileVerified && s.profileImage).length,
                        Verified:       students.filter(s => s.isNICVerified && s.isProfileVerified).length,
                        NoDoc:          students.filter(s => !s.nicFrontImage && !s.profileImage).length,
                      };
                      const isActive = svFilter === f.key;
                      const activeStyles = {
                        purple: "bg-purple-600 text-white border-purple-700 shadow-md shadow-purple-100",
                        amber:  "bg-amber-500  text-white border-amber-600  shadow-md shadow-amber-100",
                        orange: "bg-orange-500 text-white border-orange-600 shadow-md shadow-orange-100",
                        green:  "bg-green-600  text-white border-green-700  shadow-md shadow-green-100",
                        slate:  "bg-slate-600  text-white border-slate-700  shadow-md shadow-slate-100",
                      };
                      const inactiveStyles = {
                        purple: "bg-white text-slate-600  border-slate-200 hover:bg-slate-50",
                        amber:  "bg-white text-amber-700  border-amber-200  hover:bg-amber-50",
                        orange: "bg-white text-orange-700 border-orange-200 hover:bg-orange-50",
                        green:  "bg-white text-green-700  border-green-200  hover:bg-green-50",
                        slate:  "bg-white text-slate-500  border-slate-200  hover:bg-slate-50",
                      };
                      return (
                        <button
                          key={f.key}
                          onClick={() => setSvFilter(f.key)}
                          className={`px-3 py-1.5 rounded-xl border font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${isActive ? activeStyles[f.color] : inactiveStyles[f.color]}`}
                        >
                          {f.label}
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${isActive ? "bg-white/25" : "bg-slate-100 text-slate-500"}`}>
                            {countMap[f.key]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {loadingStudents ? (
                <div className="flex justify-center p-12">
                  <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredSVStudents.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs bg-slate-50 border border-slate-150 rounded-2xl p-8">
                  {svFilter === "All"
                    ? "ලියාපදිංචි ශිෂ්‍යයින් කිසිවෙකු සොයාගත නොහැක!"
                    : `"${svFilter}" පරිදි ශිෂ්‍යයින් කිසිවෙකු නොමැත.`}
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-755 font-sans">
                      <thead className="bg-slate-50 border-b border-slate-200 font-extrabold text-[10px] uppercase text-slate-500 tracking-wider">
                        <tr>
                          <th className="py-4 px-6">Student ID</th>
                          <th className="py-4 px-6">Name</th>
                          <th className="py-4 px-6">NIC Number</th>
                          <th className="py-4 px-6 text-center">NIC Status</th>
                          <th className="py-4 px-6 text-center">Profile Status</th>
                          <th className="py-4 px-6 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {filteredSVStudents.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-6 font-bold text-purple-650 font-mono tracking-wider">{s.studentId || "N/A"}</td>
                            <td className="py-4 px-6 font-semibold text-slate-800">{s.firstName} {s.lastName}</td>
                            <td className="py-4 px-6 font-mono text-slate-500">{s.nic || "N/A"}</td>
                            <td className="py-4 px-6 text-center">
                              {s.isNICVerified ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full font-bold text-[9px] uppercase shadow-sm">
                                  Verified
                                </span>
                              ) : s.nicFrontImage ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold text-[9px] uppercase shadow-sm animate-pulse">
                                  Pending Review
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-full font-bold text-[9px] uppercase">
                                  No Document
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-center">
                              {s.isProfileVerified ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full font-bold text-[9px] uppercase shadow-sm">
                                  Verified
                                </span>
                              ) : s.profileImage ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold text-[9px] uppercase shadow-sm animate-pulse">
                                  Pending Review
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-full font-bold text-[9px] uppercase">
                                  No Photo
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-center">
                              <button
                                onClick={() => setReviewingVerificationStudent(s)}
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors cursor-pointer shadow-sm border-0"
                              >
                                Review &amp; Verify
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white px-6 py-4 text-center">
          <p className="text-xs font-bold text-slate-500 tracking-wide font-sans">
            SKCHEM.COM - Sajith K Kumara
          </p>
          <p className="text-[10px] text-slate-450 mt-0.5 font-medium font-sans">
            Copyright &copy; Theekshana Viduranga <span className="font-mono text-purple-600 font-bold">&lt;/&gt;</span>
          </p>
        </footer>
      </div>

      {/* ── STUDENT PROFILE VIEWER MODAL ── */}
      {viewingStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden relative font-sans">
            <div className="bg-slate-50 text-slate-850 p-6 flex justify-between items-center border-b border-slate-200">
              <div>
                <h3 className="text-base font-extrabold">Detailed Student Profile</h3>
                <p className="text-purple-650 text-[10px] mt-0.5 font-mono">ID: <b>{viewingStudent.studentId || "N/A"}</b></p>
              </div>
              <button
                onClick={() => setViewingStudent(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer bg-transparent border-0"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center gap-4 border-b border-slate-200 pb-4 mb-4">
                {viewingStudent.profileImage ? (
                  <img
                    src={viewingStudent.profileImage}
                    alt="Profile"
                    className="w-16 h-16 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-purple-50 border border-purple-200 text-purple-650 font-bold flex items-center justify-center text-lg shadow-sm">
                    {viewingStudent.firstName?.[0]}{viewingStudent.lastName?.[0]}
                  </div>
                )}
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm">
                    {viewingStudent.firstName} {viewingStudent.lastName}
                  </h4>
                  <p className="text-xs text-slate-500">{viewingStudent.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Mobile:</span>
                  <span className="font-semibold text-slate-850">{viewingStudent.mobile || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">WhatsApp:</span>
                  <span className="font-semibold text-slate-855">{viewingStudent.whatsapp || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Other Mobile:</span>
                  <span className="font-semibold text-slate-855">{viewingStudent.otherMobile || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">NIC:</span>
                  <span className="font-semibold text-slate-855">{viewingStudent.nic || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Batch:</span>
                  <span className="font-semibold text-slate-855">{viewingStudent.batch || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">School:</span>
                  <span className="font-semibold text-slate-855">{viewingStudent.school || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Home City:</span>
                  <span className="font-semibold text-slate-855">{viewingStudent.homeCity || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Address:</span>
                  <span className="font-semibold text-slate-855">{viewingStudent.address || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Gender:</span>
                  <span className="font-semibold text-slate-855">{viewingStudent.gender || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Birthday:</span>
                  <span className="font-semibold text-slate-855 font-mono">{viewingStudent.birthday || "N/A"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ONLINE STUDENT VERIFICATION DETAIL REVIEW MODAL ── */}
      {reviewingVerificationStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden relative font-sans">
            <div className="bg-slate-50 text-slate-855 p-6 flex justify-between items-center border-b border-slate-200">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Review Online Student Account</h3>
                <p className="text-purple-650 text-[10px] mt-0.5 font-mono">ID: <b>{reviewingVerificationStudent.studentId || "N/A"}</b></p>
              </div>
              <button
                onClick={() => setReviewingVerificationStudent(null)}
                className="text-slate-400 hover:text-slate-655 font-bold text-lg cursor-pointer bg-transparent border-0"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Profile details */}
              <div className="grid grid-cols-2 gap-4 text-xs border-b border-slate-200 pb-4">
                <div>
                  <span className="text-slate-400 block mb-0.5">Name:</span>
                  <span className="font-semibold text-slate-850">{reviewingVerificationStudent.firstName} {reviewingVerificationStudent.lastName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Email:</span>
                  <span className="font-semibold text-slate-850">{reviewingVerificationStudent.email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Mobile:</span>
                  <span className="font-semibold text-slate-855 font-mono">{reviewingVerificationStudent.mobile || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">WhatsApp:</span>
                  <span className="font-semibold text-slate-855 font-mono">{reviewingVerificationStudent.whatsapp || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">NIC Number:</span>
                  <span className="font-semibold text-slate-855 font-mono">{reviewingVerificationStudent.nic || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Batch:</span>
                  <span className="font-semibold text-slate-855">{reviewingVerificationStudent.batch || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">School:</span>
                  <span className="font-semibold text-slate-855">{reviewingVerificationStudent.school || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Home Address:</span>
                  <span className="font-semibold text-slate-855">{reviewingVerificationStudent.address || "N/A"}</span>
                </div>
              </div>

              {/* Photos verification section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Profile photo */}
                <div className="border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-between gap-3 bg-slate-50/50">
                  <div className="text-center">
                    <p className="font-bold text-xs text-slate-800 mb-2">Profile Photo</p>
                    {reviewingVerificationStudent.profileImage ? (
                      <img
                        src={reviewingVerificationStudent.profileImage}
                        alt="Profile"
                        className="w-32 h-32 rounded-xl object-cover border border-slate-200 mx-auto shadow-sm"
                      />
                    ) : (
                      <div className="w-32 h-32 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 text-xs font-semibold mx-auto border border-slate-200">
                        Not Uploaded
                      </div>
                    )}
                  </div>
                  {reviewingVerificationStudent.isProfileVerified ? (
                    <span className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full font-bold text-[10px] uppercase">
                      ✓ Profile Verified
                    </span>
                  ) : (
                    <button
                      onClick={() => handleVerifyStudentProfile(reviewingVerificationStudent.id)}
                      disabled={!reviewingVerificationStudent.profileImage}
                      className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-lg text-xs shadow-sm cursor-pointer border-0"
                    >
                      Verify Profile
                    </button>
                  )}
                </div>

                {/* NIC photos */}
                <div className="border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-between gap-3 bg-slate-50/50">
                  <div className="text-center w-full">
                    <p className="font-bold text-xs text-slate-800 mb-2">National ID (NIC)</p>
                    {reviewingVerificationStudent.isNICVerified ? (
                      <div className="py-8 bg-green-50/50 border border-green-200 rounded-xl text-green-700 font-semibold text-xs space-y-1">
                        <p>✓ NIC verified successfully.</p>
                        <p className="text-[10px] text-slate-400 font-normal">NIC Images have been deleted.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Front</p>
                            {reviewingVerificationStudent.nicFrontImage ? (
                              <img
                                src={reviewingVerificationStudent.nicFrontImage}
                                alt="NIC Front"
                                onClick={() => setZoomedSlip(reviewingVerificationStudent.nicFrontImage)}
                                className="h-20 w-full object-cover rounded-lg border bg-white shadow-sm cursor-zoom-in"
                              />
                            ) : (
                              <div className="h-20 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-[10px]">No Front</div>
                            )}
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Back</p>
                            {reviewingVerificationStudent.nicBackImage ? (
                              <img
                                src={reviewingVerificationStudent.nicBackImage}
                                alt="NIC Back"
                                onClick={() => setZoomedSlip(reviewingVerificationStudent.nicBackImage)}
                                className="h-20 w-full object-cover rounded-lg border bg-white shadow-sm cursor-zoom-in"
                              />
                            ) : (
                              <div className="h-20 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-[10px]">No Back</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {reviewingVerificationStudent.isNICVerified ? (
                    <span className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full font-bold text-[10px] uppercase">
                      ✓ NIC Verified
                    </span>
                  ) : (
                    <button
                      onClick={() => handleVerifyStudentNIC(reviewingVerificationStudent.id)}
                      disabled={!reviewingVerificationStudent.nicFrontImage || !reviewingVerificationStudent.nicBackImage}
                      className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-lg text-xs shadow-sm cursor-pointer border-0"
                    >
                      Verify NIC
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ZOOMED SLIP IMAGE VIEW MODAL ── */}
      {zoomedSlip && (
        <div
          onClick={() => setZoomedSlip(null)}
          className="fixed inset-0 bg-black/95 z-55 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {zoomedSlip.startsWith("data:application/pdf;base64,") ? (
              <iframe
                src={zoomedSlip}
                title="Slip PDF"
                className="w-[85vw] h-[85vh] rounded-xl shadow-2xl border bg-white"
              />
            ) : (
              <img
                src={zoomedSlip}
                alt="Zoomed Slip"
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl border border-slate-800"
              />
            )}
            <button
              onClick={() => setZoomedSlip(null)}
              className="absolute top-4 right-4 bg-black/60 text-white font-extrabold text-sm w-8 h-8 rounded-full flex items-center justify-center shadow backdrop-blur-sm cursor-pointer border-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
