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
  updateTuteTracking
} from "../db/firestoreService";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function AdminDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState("students");
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

  useEffect(() => {
    fetchData();
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

  // QR Code Scanner effect
  useEffect(() => {
    let scanner = null;
    if (activeTab === "verification" && scannerActive) {
      try {
        scanner = new Html5QrcodeScanner(
          "qr-reader-el",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );
        scanner.render(
          (decodedText) => {
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
            // Ignore scan error
          }
        );
      } catch (err) {
        console.error("Failed to initialize html5-qrcode scanner", err);
      }
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(err => console.error("Failed to clear scanner", err));
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
      await updateTuteTracking(paymentId, {
        deliveryStatus: status,
        shippedAt: status === "Shipped" ? new Date().toISOString() : undefined,
        deliveredAt: status === "Delivered" ? new Date().toISOString() : undefined
      });
      alert(`තත්ත්වය ${status} ලෙස වෙනස් කරන ලදී.`);
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

  // Tute Deliveries List
  const tuteDeliveries = payments.filter(p => p.status === "approved" && p.tuteRequired);

  // Analytics Stats
  const activeStudentsCount = students.length;
  const pendingPayments = payments.filter((p) => p.status === "pending");
  const pendingPaymentsCount = pendingPayments.length;
  const totalClassesCount = classes.length;
  const pendingTutesCount = tuteDeliveries.filter(d => d.deliveryStatus === "Pending" || !d.deliveryStatus).length;

  const handleTabSelect = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex relative font-sans">
      
      {/* ── Left Sidebar (Desktop) / Sliding Panel (Mobile) ── */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 border-r border-gray-800 text-white flex flex-col justify-between transition-transform duration-300 transform lg:translate-x-0 lg:static lg:h-screen ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        
        {/* Brand/Logo */}
        <div>
          <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-800 bg-gray-950">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-white font-black text-base">A</span>
            </div>
            <span className="font-black text-sm tracking-widest text-purple-400">ADMIN CONTROL</span>
          </div>

          {/* Menu Items */}
          <nav className="p-4 space-y-1.5 overflow-y-auto max-h-[calc(100vh-180px)]">
            {/* Students Management */}
            <button
              onClick={() => handleTabSelect("students")}
              className={`w-full py-3 px-4 font-bold text-xs rounded-xl flex items-center gap-3 transition-all ${
                activeTab === "students" ? "bg-purple-600 text-white shadow-lg" : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              Students Management
            </button>

            {/* Add & Manage Classes */}
            <button
              onClick={() => handleTabSelect("classes")}
              className={`w-full py-3 px-4 font-bold text-xs rounded-xl flex items-center gap-3 transition-all ${
                activeTab === "classes" ? "bg-purple-600 text-white shadow-lg" : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              Add &amp; Manage Classes
            </button>

            {/* Record Upload & Zoom Live */}
            <button
              onClick={() => handleTabSelect("recordings")}
              className={`w-full py-3 px-4 font-bold text-xs rounded-xl flex items-center gap-3 transition-all ${
                activeTab === "recordings" ? "bg-purple-600 text-white shadow-lg" : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              🎥 Record Upload &amp; Zoom
            </button>

            {/* Approve Slip Payments */}
            <button
              onClick={() => handleTabSelect("approvals")}
              className={`w-full py-3 px-4 font-bold text-xs rounded-xl flex items-center justify-between transition-all ${
                activeTab === "approvals" ? "bg-purple-600 text-white shadow-lg" : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                Approve Slip Payments
              </span>
              {pendingPaymentsCount > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                  {pendingPaymentsCount}
                </span>
              )}
            </button>

            {/* Tute Delivery */}
            <button
              onClick={() => handleTabSelect("tutes")}
              className={`w-full py-3 px-4 font-bold text-xs rounded-xl flex items-center justify-between transition-all ${
                activeTab === "tutes" ? "bg-purple-600 text-white shadow-lg" : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" /></svg>
                Tute Delivery
              </span>
              {pendingTutesCount > 0 && (
                <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                  {pendingTutesCount}
                </span>
              )}
            </button>

            {/* Physical Student Verification */}
            <button
              onClick={() => handleTabSelect("verification")}
              className={`w-full py-3 px-4 font-bold text-xs rounded-xl flex items-center gap-3 transition-all ${
                activeTab === "verification" ? "bg-purple-600 text-white shadow-lg" : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0a8 8 0 11-16 0 8 8 0 0116 0z" /></svg>
              Student QR Verification
            </button>
          </nav>
        </div>

        {/* Admin Footer & Logout */}
        <div className="p-4 border-t border-gray-800 bg-gray-950/50">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-900 flex items-center justify-center font-extrabold text-sm">
              AD
            </div>
            <div className="truncate">
              <p className="text-xs font-bold truncate">System Admin</p>
              <p className="text-[10px] text-gray-500 truncate">skchem.com</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold py-2 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Backdrop (Mobile sidebar) */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-35 lg:hidden backdrop-blur-sm"
        />
      )}

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden bg-gray-950">
        
        {/* Header */}
        <header className="h-16 bg-gray-900 border-b border-gray-800 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            {/* Hamburger (Mobile) */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 lg:hidden transition-colors cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1 className="font-extrabold text-sm md:text-base text-white tracking-tight flex items-center gap-2">
              CM.ECHEM.LK — Admin Control Panel
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors border border-gray-700 flex items-center justify-center cursor-pointer"
              title="Refresh Data"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
            <span className="hidden md:inline text-[9px] text-purple-400 font-extrabold uppercase tracking-widest px-2.5 py-1 bg-purple-950/40 rounded-lg border border-purple-900/60">
              Active Session
            </span>
          </div>
        </header>

        {/* Dashboard stats panel */}
        <section className="p-6 pb-2 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider">Students</p>
            <h4 className="text-xl font-black text-white mt-1">{loadingStudents ? "..." : activeStudentsCount}</h4>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider">Pending Slips</p>
            <h4 className="text-xl font-black text-red-500 mt-1">{loadingPayments ? "..." : pendingPaymentsCount}</h4>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider">Classes</p>
            <h4 className="text-xl font-black text-white mt-1">{loadingClasses ? "..." : totalClassesCount}</h4>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider">Pending Tutes</p>
            <h4 className="text-xl font-black text-amber-500 mt-1">{loadingPayments ? "..." : pendingTutesCount}</h4>
          </div>
        </section>

        {/* Main Panel Content */}
        <main className="p-6 flex-1 overflow-y-auto">
          
          {/* ──────────────────────────────────────────────────────── */}
          {/* 1. STUDENTS MANAGEMENT TAB                               */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === "students" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
                <h2 className="text-lg font-extrabold text-white">Registered Students Directory</h2>
                <div className="relative max-w-md w-full">
                  <input
                    type="text"
                    placeholder="ID, Name, Mobile or School වලින් සොයන්න..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-800 rounded-xl text-xs bg-gray-900 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </span>
                </div>
              </div>

              {loadingStudents ? (
                <div className="flex justify-center p-12">
                  <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-xs bg-gray-900 rounded-2xl border border-gray-800 p-8">
                  ශිෂ්‍යයින් කිසිවෙකු සොයාගත නොහැකි විය.
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-300">
                      <thead className="bg-gray-950 border-b border-gray-800 font-extrabold text-[10px] uppercase text-gray-500 tracking-wider">
                        <tr>
                          <th className="py-4 px-6">Student ID</th>
                          <th className="py-4 px-6">Name</th>
                          <th className="py-4 px-6">AL Batch</th>
                          <th className="py-4 px-6">Mobile</th>
                          <th className="py-4 px-6">City</th>
                          <th className="py-4 px-6 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800 font-medium">
                        {filteredStudents.map((s) => (
                          <tr key={s.id} className="hover:bg-gray-850 transition-colors">
                            <td className="py-4 px-6 font-bold text-purple-400 font-mono tracking-wider">{s.studentId || "N/A"}</td>
                            <td className="py-4 px-6 font-semibold text-white">{s.firstName} {s.lastName}</td>
                            <td className="py-4 px-6">
                              <span className="px-2.5 py-0.5 bg-gray-800 text-gray-300 text-[9px] font-bold rounded uppercase">
                                {s.batch}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-gray-400 font-mono">{s.mobile}</td>
                            <td className="py-4 px-6 text-gray-400">{s.homeCity}</td>
                            <td className="py-4 px-6 flex items-center justify-center gap-2">
                              <button
                                onClick={() => setViewingStudent(s)}
                                className="px-3 py-1.5 bg-purple-950/50 hover:bg-purple-900/60 border border-purple-800/40 text-purple-300 font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                Profile
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(s.id)}
                                className="px-3 py-1.5 bg-red-950/50 hover:bg-red-900/60 border border-red-800/40 text-red-300 font-bold rounded-lg transition-colors cursor-pointer"
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
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-sm h-fit">
                <h3 className="font-extrabold text-white text-base border-b border-gray-800 pb-3 mb-4">Add New Class Catalog</h3>
                <form onSubmit={handleAddClassSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Class Title</label>
                    <input
                      type="text"
                      placeholder="2026 Revision Only | June"
                      value={classForm.title}
                      onChange={(e) => setClassForm({ ...classForm, title: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-800 rounded-lg text-xs bg-gray-950 text-white focus:bg-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Price (LKR)</label>
                    <input
                      type="number"
                      placeholder="3300"
                      value={classForm.price}
                      onChange={(e) => setClassForm({ ...classForm, price: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-800 rounded-lg text-xs bg-gray-950 text-white focus:bg-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Target Month</label>
                    <select
                      value={classForm.month}
                      onChange={(e) => setClassForm({ ...classForm, month: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-800 rounded-lg text-xs bg-gray-950 text-gray-300"
                    >
                      {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">AL Batch Compatibility</label>
                    <select
                      value={classForm.batch}
                      onChange={(e) => setClassForm({ ...classForm, batch: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-800 rounded-lg text-xs bg-gray-950 text-gray-300"
                    >
                      <option value="2026AL">2026 A/L</option>
                      <option value="2027AL">2027 A/L</option>
                      <option value="2028AL">2028 A/L</option>
                      <option value="2026Rapid">2026 Rapid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Description (Optional)</label>
                    <textarea
                      placeholder="Class objectives, details..."
                      value={classForm.description}
                      onChange={(e) => setClassForm({ ...classForm, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-800 rounded-lg text-xs bg-gray-950 text-white focus:bg-gray-900"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={addingClassStatus === "adding"}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-2.5 rounded-lg text-xs transition-colors shadow flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {addingClassStatus === "adding" ? "Creating..." : "Add Class to Catalog"}
                  </button>
                  {addingClassStatus === "success" && (
                    <p className="text-center text-green-500 text-xs font-bold mt-2">Class added successfully! 🎉</p>
                  )}
                </form>
              </div>

              {/* Existing Classes Catalog */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="font-extrabold text-white text-base border-b border-gray-800 pb-3">Active Classes List</h3>
                {loadingClasses ? (
                  <div className="flex justify-center p-12">
                    <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : classes.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 text-xs bg-gray-900 rounded-2xl border border-gray-800 p-8">
                    මෙතෙක් කිසිදු පන්තියක් ඇතුළත් කර නැත.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {classes.map((cls) => (
                      <div key={cls.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-sm space-y-3 flex flex-col justify-between hover:border-gray-700 transition-all">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-start">
                            <span className="px-2 py-0.5 bg-purple-950 text-purple-400 border border-purple-900/60 text-[9px] font-extrabold rounded uppercase tracking-wider">
                              {cls.batch}
                            </span>
                            <span className="font-bold text-white text-xs">LKR {cls.price}</span>
                          </div>
                          <h4 className="font-bold text-white text-sm">{cls.title}</h4>
                          <p className="text-[10px] text-gray-500">Target Month: {cls.month}</p>
                          <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-3">
                            {cls.description || "No description provided."}
                          </p>
                        </div>
                        <div className="border-t border-gray-850 pt-3 flex justify-end">
                          <button
                            onClick={() => handleDeleteClass(cls.id)}
                            className="px-3 py-1.5 bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-900/55 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Delete Class
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
          {/* 3. RECORD UPLOAD & ZOOM LIVE TAB                          */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === "recordings" && (
            <div className="space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-sm">
                <h2 className="text-base font-extrabold text-white mb-4">🎥 Record Upload &amp; Zoom Live Manager</h2>
                <div className="max-w-sm">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Select Class to Manage</label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-800 rounded-xl text-xs bg-gray-950 text-white"
                  >
                    <option value="">-- Choose Class --</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.title} ({c.batch})</option>
                    ))}
                  </select>
                </div>
              </div>

              {classDetails ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Zoom Live Section */}
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="border-b border-gray-800 pb-3">
                      <h3 className="font-extrabold text-white text-sm">Zoom Live Link Settings</h3>
                      <p className="text-gray-500 text-[10px]">සජීවී දේශනයේ සබැඳි ශිෂ්‍යයාට මෙතැනින් එකතු කරන්න.</p>
                    </div>

                    <form onSubmit={handleUpdateZoom} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-450 uppercase mb-1">Zoom Live URL</label>
                        <input
                          type="url"
                          placeholder="https://zoom.us/j/..."
                          value={zoomForm.zoomLink}
                          onChange={(e) => setZoomForm({ ...zoomForm, zoomLink: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-800 rounded-lg text-xs bg-gray-950 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-450 uppercase mb-1">Live Notice / Caption</label>
                        <input
                          type="text"
                          placeholder="Revision class starts at 8.00 AM today!"
                          value={zoomForm.zoomCaption}
                          onChange={(e) => setZoomForm({ ...zoomForm, zoomCaption: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-800 rounded-lg text-xs bg-gray-950 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={updatingZoomStatus === "updating"}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-2 px-4 rounded-lg text-xs transition-colors cursor-pointer shadow-md"
                      >
                        {updatingZoomStatus === "updating" ? "Saving..." : "Save Zoom Live Settings"}
                      </button>
                      {updatingZoomStatus === "success" && (
                        <p className="text-green-500 text-xs font-bold mt-2">Zoom Link Saved successfully! 💻</p>
                      )}
                    </form>
                  </div>

                  {/* Recorded Videos Section */}
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
                    <div className="border-b border-gray-800 pb-3">
                      <h3 className="font-extrabold text-white text-sm">Recorded Video Lectures</h3>
                      <p className="text-gray-500 text-[10px]">පටිගත කරන ලද වීඩියෝ දේශන මෙතැනින් එකතු/ඉවත් කරන්න.</p>
                    </div>

                    {/* Add Video Form */}
                    <form onSubmit={handleAddVideo} className="bg-gray-950 border border-gray-850 p-4 rounded-xl space-y-3">
                      <p className="font-bold text-gray-300 text-xs">Add New Video Lesson</p>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">Video Caption</label>
                        <input
                          type="text"
                          placeholder="Lesson 1 - Organic Chemistry Intro"
                          value={videoForm.caption}
                          onChange={(e) => setVideoForm({ ...videoForm, caption: e.target.value })}
                          required
                          className="w-full px-3 py-1.5 border border-gray-800 rounded-lg text-xs bg-gray-900 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">YouTube Video URL</label>
                        <input
                          type="url"
                          placeholder="https://www.youtube.com/watch?v=..."
                          value={videoForm.youtubeLink}
                          onChange={(e) => setVideoForm({ ...videoForm, youtubeLink: e.target.value })}
                          required
                          className="w-full px-3 py-1.5 border border-gray-800 rounded-lg text-xs bg-gray-900 text-white"
                        />
                      </div>
                      <button
                        type="submit"
                        className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-1.5 px-3 rounded-lg text-xs transition-colors cursor-pointer"
                      >
                        Add Video
                      </button>
                    </form>

                    {/* Existing Videos List */}
                    <div className="space-y-2">
                      <p className="font-bold text-gray-300 text-xs">Videos List ({classDetails.videos?.length || 0})</p>
                      {(!classDetails.videos || classDetails.videos.length === 0) ? (
                        <p className="text-gray-500 text-xs">මෙම පන්තියට තවමත් වීඩියෝ කිසිවක් එකතු කර නැත.</p>
                      ) : (
                        <div className="divide-y divide-gray-800 max-h-60 overflow-y-auto border border-gray-850 rounded-xl bg-gray-950">
                          {classDetails.videos.map((vid, index) => (
                            <div key={index} className="p-3 flex items-center justify-between gap-4 text-xs">
                              <div className="truncate">
                                <p className="font-bold text-white truncate">{vid.caption}</p>
                                <p className="text-[10px] text-gray-550 font-mono truncate">{vid.youtubeLink}</p>
                              </div>
                              <button
                                onClick={() => handleDeleteVideo(index)}
                                className="text-red-400 hover:text-red-500 font-bold text-[11px] flex-shrink-0 cursor-pointer"
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
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center text-gray-500 text-xs">
                  කරුණාකර ඉහතින් පන්තියක් තෝරාගන්න.
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* 4. APPROVE SLIP PAYMENTS TAB                             */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === "approvals" && (
            <div className="space-y-6">
              <h2 className="text-lg font-extrabold text-white">Pending Slip Payments Approval</h2>

              {loadingPayments ? (
                <div className="flex justify-center p-12">
                  <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : pendingPayments.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-xs bg-gray-900 rounded-2xl border border-gray-800 p-8">
                  අනුමත කිරීමට බලාපොරොත්තුවෙන් පවතින ගෙවීම් රිසිට්පත් කිසිවක් නැත!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pendingPayments.map((pay) => (
                    <div key={pay.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between hover:border-gray-700 transition-all">
                      <div>
                        {/* Slip preview */}
                        <div
                          onClick={() => setZoomedSlip(pay.slipImage)}
                          className="h-44 bg-gray-950 flex items-center justify-center overflow-hidden cursor-zoom-in relative border-b border-gray-850"
                        >
                          <img
                            src={pay.slipImage}
                            alt="Slip"
                            className="h-full w-full object-contain hover:scale-105 transition-transform"
                          />
                          <span className="absolute bottom-3 right-3 bg-black/60 text-white text-[9px] font-bold py-1 px-2 rounded-full backdrop-blur-sm">
                            🔍 Click to zoom
                          </span>
                        </div>

                        {/* Payment Details */}
                        <div className="p-4 space-y-3">
                          <div>
                            <p className="text-[9px] font-bold text-purple-400 uppercase tracking-widest font-mono">
                              ID: {pay.studentId}
                            </p>
                            <h4 className="font-extrabold text-white text-sm mt-0.5">{pay.studentName}</h4>
                          </div>

                          <div className="bg-gray-950 border border-gray-850 rounded-xl p-3 text-[11px] space-y-1.5">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Class:</span>
                              <span className="font-bold text-gray-300">{pay.classTitle}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Amount:</span>
                              <span className="font-bold text-gray-300">LKR {pay.price}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Date:</span>
                              <span className="text-gray-400 font-mono">
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
                          className="flex-1 py-1.5 px-3 bg-red-950/20 hover:bg-red-900/30 text-red-400 font-extrabold text-xs rounded-lg transition-colors border border-red-900/50 cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApprovePayment(pay.id)}
                          className="flex-1 py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white font-extrabold text-xs rounded-lg shadow transition-colors cursor-pointer"
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
              <h2 className="text-lg font-extrabold text-white">Tute Delivery Tracking System</h2>

              {loadingPayments ? (
                <div className="flex justify-center p-12">
                  <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : tuteDeliveries.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-xs bg-gray-900 rounded-2xl border border-gray-800 p-8">
                  නිබන්ධන තැපැල් කිරීමේ ඉල්ලීම් කිසිවක් දැනට නොමැත.
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-300">
                      <thead className="bg-gray-950 border-b border-gray-850 font-extrabold text-[10px] uppercase text-gray-500 tracking-wider">
                        <tr>
                          <th className="py-4 px-6">Student</th>
                          <th className="py-4 px-6">Tute / Class</th>
                          <th className="py-4 px-6">Delivery Address</th>
                          <th className="py-4 px-6">Tracking Details</th>
                          <th className="py-4 px-6">Status</th>
                          <th className="py-4 px-6 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800 font-medium">
                        {tuteDeliveries.map((delivery) => (
                          <tr key={delivery.id} className="hover:bg-gray-850 transition-colors">
                            <td className="py-4 px-6">
                              <p className="font-bold text-white">{delivery.studentName}</p>
                              <p className="text-[10px] text-gray-500 font-mono">ID: {delivery.studentId}</p>
                              <p className="text-[10px] text-gray-500 font-mono">Tel: {delivery.deliveryPhone || "N/A"}</p>
                            </td>
                            <td className="py-4 px-6">
                              <p className="font-bold text-gray-300">{delivery.classTitle}</p>
                            </td>
                            <td className="py-4 px-6">
                              <p className="max-w-xs break-words text-gray-400 font-medium">{delivery.deliveryAddress || "N/A"}</p>
                            </td>
                            <td className="py-4 px-6 space-y-1">
                              {editingTuteId === delivery.id ? (
                                <div className="space-y-1.5 max-w-xs">
                                  <input
                                    type="text"
                                    placeholder="Tracking ID"
                                    value={tuteForm.trackingId}
                                    onChange={(e) => setTuteForm({ ...tuteForm, trackingId: e.target.value })}
                                    className="px-2 py-1 border border-gray-800 bg-gray-950 text-white rounded w-full text-[11px]"
                                  />
                                  <input
                                    type="url"
                                    placeholder="Courier URL"
                                    value={tuteForm.courierLink}
                                    onChange={(e) => setTuteForm({ ...tuteForm, courierLink: e.target.value })}
                                    className="px-2 py-1 border border-gray-800 bg-gray-950 text-white rounded w-full text-[11px]"
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
                                      className="px-2.5 py-1 bg-gray-800 text-gray-400 font-bold rounded text-[10px] cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p>
                                    ID:{" "}
                                    <span className="font-bold text-purple-400 font-mono">
                                      {delivery.trackingId || "None"}
                                    </span>
                                  </p>
                                  {delivery.courierLink && (
                                    <a
                                      href={delivery.courierLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-400 hover:underline text-[10px] block"
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
                                    className="text-[10px] text-purple-400 hover:text-purple-300 font-bold cursor-pointer"
                                  >
                                    Edit Details
                                  </button>
                                </>
                              )}
                            </td>
                            <td className="py-4 px-6">
                              {delivery.deliveryStatus === "Delivered" ? (
                                <span className="px-2 py-0.5 bg-green-950/60 text-green-400 border border-green-900/40 rounded-full font-bold text-[9px] uppercase">
                                  Delivered
                                </span>
                              ) : delivery.deliveryStatus === "Shipped" ? (
                                <span className="px-2 py-0.5 bg-blue-950/60 text-blue-400 border border-blue-900/40 rounded-full font-bold text-[9px] uppercase">
                                  Shipped
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-amber-950/60 text-amber-400 border border-amber-900/40 rounded-full font-bold text-[9px] uppercase">
                                  Pending
                                </span>
                              )}
                              {delivery.studentConfirmed && (
                                <p className="text-[10px] text-green-400 font-extrabold mt-1">✓ Received By Student</p>
                              )}
                            </td>
                            <td className="py-4 px-6 text-center space-y-1.5">
                              <button
                                onClick={() => handleTuteStatusChange(delivery.id, "Shipped")}
                                className="px-2 py-1 bg-blue-950/30 hover:bg-blue-900/40 text-blue-400 rounded border border-blue-900/50 text-[10px] font-bold w-24 cursor-pointer"
                              >
                                Shipped
                              </button>
                              <br />
                              <button
                                onClick={() => handleTuteStatusChange(delivery.id, "Delivered")}
                                className="px-2 py-1 bg-green-950/30 hover:bg-green-900/40 text-green-400 rounded border border-green-900/50 text-[10px] font-bold w-24 cursor-pointer"
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
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-sm space-y-4">
                <div>
                  <h2 className="text-base font-extrabold text-white">Physical Student Verification</h2>
                  <p className="text-gray-500 text-xs">QR කේතය ස්කෑන් කිරීමෙන් හෝ ශිෂ්‍ය හැඳුනුම්පත (Student ID) ඇතුළත් කිරීමෙන් ශිෂ්‍යයා සොයා පන්ති සක්‍රීය කරන්න.</p>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 max-w-sm">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Enter Student ID</label>
                    <input
                      type="text"
                      placeholder="e.g. SK123456"
                      value={verificationSearchId}
                      onChange={(e) => setVerificationSearchId(e.target.value.toUpperCase())}
                      className="w-full px-4 py-2 border border-gray-800 rounded-xl text-xs bg-gray-950 text-white"
                    />
                  </div>
                  <button
                    onClick={() => handleSearchStudent()}
                    disabled={searchingStudent || !verificationSearchId}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-2 px-4 rounded-xl text-xs transition-colors shadow cursor-pointer"
                  >
                    {searchingStudent ? "Searching..." : "Search Student"}
                  </button>
                  <button
                    onClick={() => setScannerActive(!scannerActive)}
                    className={`font-extrabold py-2 px-4 rounded-xl text-xs transition-colors shadow flex items-center gap-1.5 cursor-pointer ${
                      scannerActive ? "bg-red-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0a8 8 0 11-16 0 8 8 0 0116 0z" /></svg>
                    {scannerActive ? "Stop Camera" : "Scan Student QR"}
                  </button>
                </div>

                {/* QR Reader Element */}
                {scannerActive && (
                  <div className="max-w-md mx-auto border border-gray-800 rounded-2xl overflow-hidden p-4 bg-gray-950 shadow-lg space-y-2">
                    <p className="text-center font-bold text-red-500 text-[10px] animate-pulse">📷 CAMERA SCANNING ACTIVE</p>
                    <div id="qr-reader-el" className="bg-white rounded-xl overflow-hidden" />
                  </div>
                )}
              </div>

              {/* Student details & class activator */}
              {verifiedStudent && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Student Details Card */}
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-sm h-fit space-y-4">
                    <div className="border-b border-gray-800 pb-3 flex items-center gap-3">
                      {verifiedStudent.profileImage ? (
                        <img
                          src={verifiedStudent.profileImage}
                          alt="Profile"
                          className="w-14 h-14 rounded-full object-cover border border-gray-850"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-purple-950 border border-purple-800 text-purple-400 font-extrabold flex items-center justify-center text-lg">
                          {verifiedStudent.firstName?.[0]}{verifiedStudent.lastName?.[0]}
                        </div>
                      )}
                      <div>
                        <h4 className="font-extrabold text-white text-sm">
                          {verifiedStudent.firstName} {verifiedStudent.lastName}
                        </h4>
                        <p className="text-[10px] text-gray-500">{verifiedStudent.email}</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-gray-850 pb-1.5">
                        <span className="text-gray-500">Student ID:</span>
                        <span className="font-bold text-purple-400 font-mono tracking-wider">
                          {verifiedStudent.studentId || "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-gray-855 pb-1.5">
                        <span className="text-gray-500">Batch:</span>
                        <span className="font-bold text-gray-300">{verifiedStudent.batch || "N/A"}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-855 pb-1.5">
                        <span className="text-gray-500">Mobile:</span>
                        <span className="font-bold text-gray-350 font-mono">{verifiedStudent.mobile || "N/A"}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-855 pb-1.5">
                        <span className="text-gray-500">NIC:</span>
                        <span className="font-bold text-gray-350 font-mono">{verifiedStudent.nic || "N/A"}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-855 pb-1.5">
                        <span className="text-gray-500">Home City:</span>
                        <span className="font-bold text-gray-350">{verifiedStudent.homeCity || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Classes Activator Card */}
                  <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-sm space-y-4">
                    <h3 className="font-extrabold text-white text-base border-b border-gray-800 pb-3">Activate Class Packages for Student</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {classes.map(c => {
                        const isCurrentlyActive = studentActiveClasses.includes(c.id);
                        return (
                          <div
                            key={c.id}
                            className={`p-4 border rounded-xl flex items-center justify-between gap-4 transition-all ${
                              isCurrentlyActive ? "bg-green-950/20 border-green-900/50" : "bg-gray-950 border-gray-850 hover:bg-gray-900"
                            }`}
                          >
                            <div>
                              <p className="font-bold text-white text-xs">{c.title}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">Month: {c.month} | Price: LKR {c.price}</p>
                            </div>
                            <button
                              onClick={() => handleTogglePhysicalClass(c, isCurrentlyActive)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition-all cursor-pointer ${
                                isCurrentlyActive
                                  ? "bg-red-950/50 border border-red-800/40 text-red-400 hover:bg-red-900/40"
                                  : "bg-green-600 hover:bg-green-700 text-white"
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
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-800 bg-gray-900 px-6 py-4 text-center">
          <p className="text-xs font-bold text-gray-500 tracking-wide font-sans">
            SKCHEM.COM - Sujith K Kumara
          </p>
          <p className="text-[10px] text-gray-600 mt-0.5 font-medium font-sans">
            Copyright &copy; Theekshana Viduranga <span className="font-mono">&lt;/&gt;</span>
          </p>
        </footer>
      </div>

      {/* ── STUDENT PROFILE VIEWER MODAL ── */}
      {viewingStudent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 text-gray-100 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden relative font-sans">
            <div className="bg-gray-950 text-white p-6 flex justify-between items-center border-b border-gray-850">
              <div>
                <h3 className="text-base font-extrabold">Detailed Student Profile</h3>
                <p className="text-purple-400 text-[10px] mt-0.5 font-mono">ID: <b>{viewingStudent.studentId || "N/A"}</b></p>
              </div>
              <button
                onClick={() => setViewingStudent(null)}
                className="text-gray-400 hover:text-white font-bold text-lg cursor-pointer bg-transparent border-0"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center gap-4 border-b border-gray-850 pb-4 mb-4">
                {viewingStudent.profileImage ? (
                  <img
                    src={viewingStudent.profileImage}
                    alt="Profile"
                    className="w-16 h-16 rounded-full object-cover border border-gray-800"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-purple-950 border border-purple-800 text-purple-400 font-bold flex items-center justify-center text-lg">
                    {viewingStudent.firstName?.[0]}{viewingStudent.lastName?.[0]}
                  </div>
                )}
                <div>
                  <h4 className="font-extrabold text-white text-sm">
                    {viewingStudent.firstName} {viewingStudent.lastName}
                  </h4>
                  <p className="text-xs text-gray-500">{viewingStudent.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-500 block mb-0.5">Mobile:</span>
                  <span className="font-semibold text-white">{viewingStudent.mobile || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">WhatsApp:</span>
                  <span className="font-semibold text-white">{viewingStudent.whatsapp || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Other Mobile:</span>
                  <span className="font-semibold text-white">{viewingStudent.otherMobile || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">NIC:</span>
                  <span className="font-semibold text-white">{viewingStudent.nic || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Batch:</span>
                  <span className="font-semibold text-white">{viewingStudent.batch || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">School:</span>
                  <span className="font-semibold text-white">{viewingStudent.school || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Home City:</span>
                  <span className="font-semibold text-white">{viewingStudent.homeCity || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Address:</span>
                  <span className="font-semibold text-white">{viewingStudent.address || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Gender:</span>
                  <span className="font-semibold text-white">{viewingStudent.gender || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Birthday:</span>
                  <span className="font-semibold text-white font-mono">{viewingStudent.birthday || "N/A"}</span>
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
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={zoomedSlip}
              alt="Zoomed Slip"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl border border-gray-800"
            />
            <button
              onClick={() => setZoomedSlip(null)}
              className="absolute top-4 right-4 bg-black/60 text-white font-extrabold text-sm w-8 h-8 rounded-full flex items-center justify-center shadow backdrop-blur-sm cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
