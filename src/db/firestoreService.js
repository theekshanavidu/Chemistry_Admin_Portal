import { db } from "../config/firebase";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  addDoc
} from "firebase/firestore";

// ── ADMIN: Students Management ─────────────────────────────────────

/**
 * Retrieve all registered students.
 */
export const getAllStudents = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "students"));
    const students = [];
    querySnapshot.forEach((doc) => {
      students.push({ id: doc.id, ...doc.data() });
    });
    return students;
  } catch (error) {
    console.error("Error getting students: ", error);
    throw error;
  }
};

/**
 * Delete a student from Firestore.
 */
export const deleteStudent = async (uid) => {
  try {
    await deleteDoc(doc(db, "students", uid));
    return { success: true };
  } catch (error) {
    console.error("Error deleting student: ", error);
    throw error;
  }
};

// ── CLASSES: Catalog ───────────────────────────────────────────────

/**
 * Add a new class to the purchase catalog.
 */
export const addClass = async (classData) => {
  try {
    const docRef = await addDoc(collection(db, "classes"), {
      ...classData,
      createdAt: serverTimestamp(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error adding class: ", error);
    throw error;
  }
};

/**
 * Retrieve all classes in the purchase catalog.
 */
export const getClasses = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "classes"));
    const classes = [];
    querySnapshot.forEach((doc) => {
      classes.push({ id: doc.id, ...doc.data() });
    });
    return classes;
  } catch (error) {
    console.error("Error getting classes: ", error);
    throw error;
  }
};

/**
 * Delete a class from the catalog.
 */
export const deleteClass = async (classId) => {
  try {
    await deleteDoc(doc(db, "classes", classId));
    return { success: true };
  } catch (error) {
    console.error("Error deleting class: ", error);
    throw error;
  }
};

// ── PAYMENTS & PURCHASES ──────────────────────────────────────────

/**
 * Get all payment records for the admin to approve/reject.
 */
export const getAllPayments = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "payments"));
    const payments = [];
    querySnapshot.forEach((doc) => {
      payments.push({ id: doc.id, ...doc.data() });
    });
    return payments;
  } catch (error) {
    console.error("Error getting all payments: ", error);
    throw error;
  }
};

/**
 * Approve a pending payment.
 */
export const approvePayment = async (paymentId) => {
  try {
    const paymentRef = doc(db, "payments", paymentId);
    await updateDoc(paymentRef, {
      status: "approved",
      approvedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error approving payment: ", error);
    throw error;
  }
};

export const rejectPayment = async (paymentId) => {
  try {
    const paymentRef = doc(db, "payments", paymentId);
    await updateDoc(paymentRef, {
      status: "rejected",
      rejectedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error rejecting payment: ", error);
    throw error;
  }
};

/**
 * Update specific fields of a class.
 */
export const updateClassFields = async (classId, fields) => {
  try {
    const classRef = doc(db, "classes", classId);
    await updateDoc(classRef, {
      ...fields,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating class fields: ", error);
    throw error;
  }
};

/**
 * Update tracking and delivery details for a payment.
 */
export const updateTuteTracking = async (paymentId, trackingData) => {
  try {
    const paymentRef = doc(db, "payments", paymentId);
    await updateDoc(paymentRef, {
      ...trackingData,
      trackingUpdatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating tute tracking details: ", error);
    throw error;
  }
};

/**
 * Retrieve all payments for a specific student.
 */
export const getStudentPayments = async (studentUid) => {
  try {
    const q = query(collection(db, "payments"), where("studentUid", "==", studentUid));
    const querySnapshot = await getDocs(q);
    const payments = [];
    querySnapshot.forEach((doc) => {
      payments.push({ id: doc.id, ...doc.data() });
    });
    return payments;
  } catch (error) {
    console.error("Error getting student payments: ", error);
    throw error;
  }
};

/**
 * Find a student profile by their custom Student ID.
 */
export const getStudentByStudentId = async (studentId) => {
  try {
    const q = query(collection(db, "students"), where("studentId", "==", studentId));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error("Error finding student by ID:", error);
    throw error;
  }
};

/**
 * Activate a class physically for a student.
 */
export const activateClassForStudent = async (studentUid, studentName, studentId, classId, classTitle, price) => {
  try {
    const q = query(
      collection(db, "payments"),
      where("studentUid", "==", studentUid),
      where("classId", "==", classId)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const payDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, "payments", payDoc.id), {
        status: "approved",
        approvedAt: new Date().toISOString(),
        paymentType: "physical_activation"
      });
    } else {
      await addDoc(collection(db, "payments"), {
        studentUid,
        studentName,
        studentId,
        classId,
        classTitle,
        price: Number(price),
        status: "approved",
        paymentType: "physical_activation",
        submittedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        tuteRequired: true,
        deliveryStatus: "Pending"
      });
    }
    return { success: true };
  } catch (error) {
    console.error("Error activating class for student:", error);
    throw error;
  }
};

/**
 * Deactivate a class for a student.
 */
export const deactivateClassForStudent = async (studentUid, classId) => {
  try {
    const q = query(
      collection(db, "payments"),
      where("studentUid", "==", studentUid),
      where("classId", "==", classId)
    );
    const querySnapshot = await getDocs(q);

    for (const docSnap of querySnapshot.docs) {
      await deleteDoc(doc(db, "payments", docSnap.id));
    }
    return { success: true };
  } catch (error) {
    console.error("Error deactivating class for student:", error);
    throw error;
  }
};

/**
 * Save admin details to Firestore 'admins' collection.
 */
export const saveAdminProfile = async (uid, adminData) => {
  try {
    const adminRef = doc(db, "admins", uid);
    await setDoc(adminRef, {
      ...adminData,
      uid,
      role: "admin",
      createdAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error saving admin profile:", error);
    throw error;
  }
};

/**
 * Fetch admin profile by UID.
 */
export const getAdminProfile = async (uid) => {
  try {
    const adminRef = doc(db, "admins", uid);
    const docSnap = await getDoc(adminRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error("Error fetching admin profile:", error);
    throw error;
  }
};

/**
 * Verify a student's National ID Card (NIC).
 * Immediately deletes the nicFrontImage and nicBackImage fields to preserve storage and privacy.
 */
export const verifyStudentNIC = async (uid) => {
  try {
    const studentDocRef = doc(db, "students", uid);
    await updateDoc(studentDocRef, {
      isNICVerified: true,
      nicFrontImage: "",
      nicBackImage: ""
    });
    return { success: true };
  } catch (error) {
    console.error("Error verifying student NIC: ", error);
    throw error;
  }
};

/**
 * Verify a student's Profile (photo and details).
 */
export const verifyStudentProfile = async (uid) => {
  try {
    const studentDocRef = doc(db, "students", uid);
    await updateDoc(studentDocRef, {
      isProfileVerified: true
    });
    return { success: true };
  } catch (error) {
    console.error("Error verifying student profile: ", error);
    throw error;
  }
};

/**
 * Auto-delete tute delivery records where deliveryStatus === "Shipped"
 * and shippedAt was more than 2 weeks (14 days) ago.
 */
export const cleanupShippedTutes = async () => {
  try {
    const q = query(
      collection(db, "payments"),
      where("deliveryStatus", "==", "Shipped")
    );
    const querySnapshot = await getDocs(q);
    const now = Date.now();
    const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      if (data.shippedAt) {
        const shippedTime = new Date(data.shippedAt).getTime();
        if (now - shippedTime > twoWeeksMs) {
          await deleteDoc(doc(db, "payments", docSnap.id));
          console.log(`Deleted shipped tute (2 weeks old): ${docSnap.id}`);
        }
      }
    }
  } catch (error) {
    console.error("Error cleaning up shipped tutes: ", error);
  }
};

/**
 * Clean up approved slips that are older than 7 days.
 * Deletes the slipImage field content from Firestore to save storage and ensure privacy.
 */
export const cleanupExpiredSlips = async () => {
  try {
    const q = query(collection(db, "payments"), where("status", "==", "approved"));
    const querySnapshot = await getDocs(q);
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      if (data.slipImage && data.approvedAt) {
        const approvedTime = new Date(data.approvedAt).getTime();
        if (now - approvedTime > sevenDaysMs) {
          await updateDoc(doc(db, "payments", docSnap.id), {
            slipImage: ""
          });
        }
      }
    }
  } catch (error) {
    console.error("Error cleaning up expired slips: ", error);
  }
};
