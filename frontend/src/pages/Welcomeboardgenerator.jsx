import React, { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Welcome Board Generator
 *
 * Features:
 * - Add / remove guests
 * - Change guest name font size, color, and font style
 * - Change designation font size, color, and font style
 * - Change company/university font size, color, and font style
 * - Live preview
 * - Drag any line on the preview to nudge its position
 * - Download as A3 landscape PDF
 */

const ORANGE = "#F2760C";
const BLUE = "#1B3E8C";

const PAGE_W_PT = 1190.55;
const PAGE_H_PT = 841.89;

const IMG_W = 2481;
const IMG_H = 1754;

let uid = 2;

// =============================================================
// FONT STYLE OPTIONS
// =============================================================

const FONT_OPTIONS = [
  { label: "Barlow ExtraBold", value: "'Barlow', sans-serif" },
  { label: "Poppins", value: "'Poppins', sans-serif" },
  { label: "Montserrat", value: "'Montserrat', sans-serif" },
  { label: "Playfair Display", value: "'Playfair Display', serif" },
  { label: "Merriweather", value: "'Merriweather', serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
];

export default function WelcomeBoardGenerator() {
  const boardRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);

  // =========================================================
  // GUEST DATA
  // =========================================================

  const [guests, setGuests] = useState([
    {
      id: 0,
      name: "",
      designation:
        "",
    },
    {
      id: 1,
      name: "",
      designation: "",
    },
  ]);

  // =========================================================
  // COMPANY NAME
  // =========================================================

  const [companyName, setCompanyName] = useState(
    ""
  );

  // =========================================================
  // TEXT CUSTOMIZATION
  // =========================================================

  const [nameFontSize, setNameFontSize] = useState(90);
  const [nameColor, setNameColor] = useState(ORANGE);
  const [nameFontFamily, setNameFontFamily] = useState(
    FONT_OPTIONS[0].value
  );

  const [designationFontSize, setDesignationFontSize] =
    useState(65);
  const [designationColor, setDesignationColor] =
    useState(BLUE);
  const [designationFontFamily, setDesignationFontFamily] =
    useState(FONT_OPTIONS[0].value);

  const [companyFontSize, setCompanyFontSize] =
    useState(60);
  const [companyColor, setCompanyColor] =
    useState(BLUE);
  const [companyFontFamily, setCompanyFontFamily] = useState(
    FONT_OPTIONS[0].value
  );

  // =========================================================
  // LINE POSITIONS (drag offsets)
  // =========================================================

  const [linePositions, setLinePositions] = useState({});

  const updateLinePosition = (key, dx, dy) => {
    setLinePositions((prev) => {
      const current = prev[key] || { x: 0, y: 0 };
      return {
        ...prev,
        [key]: {
          x: current.x + dx,
          y: current.y + dy,
        },
      };
    });
  };

  const resetPositions = () => {
    setLinePositions({});
    setLineScales({});
  };

  // =========================================================
  // LINE STRETCH (horizontal scale via drag handle)
  // =========================================================

  const [lineScales, setLineScales] = useState({});

  const updateLineScale = (key, deltaScale) => {
    setLineScales((prev) => {
      const current = prev[key] ?? 1;
      const next = Math.min(3, Math.max(0.4, current + deltaScale));
      return {
        ...prev,
        [key]: next,
      };
    });
  };

  // Generic numeric stretch control — works for the company line AND
  // for any guest's name/designation line, including guests added later
  const getLineStretchPercent = (key) =>
    Math.round((lineScales[key] ?? 1) * 100);

  const setLineStretchPercent = (key, percent) => {
    const clamped = Math.min(300, Math.max(40, percent));
    setLineScales((prev) => ({
      ...prev,
      [key]: clamped / 100,
    }));
  };

  // One combined stretch field per guest — applies the same
  // percentage to both that guest's name line and designation line
  const getGuestStretchPercent = (guestId) =>
    getLineStretchPercent(`name-${guestId}`);

  const setGuestStretchPercent = (guestId, percent) => {
    setLineStretchPercent(`name-${guestId}`, percent);
    setLineStretchPercent(`designation-${guestId}`, percent);
  };

  // =========================================================
  // LOAD FONTS (Barlow + the selectable font style options)
  // =========================================================

  useEffect(() => {
    const link = document.createElement("link");

    link.rel = "stylesheet";

    link.href =
      "https://fonts.googleapis.com/css2?family=Barlow:wght@700;800;900&family=Poppins:wght@700;800;900&family=Montserrat:wght@700;800;900&family=Playfair+Display:wght@700;800;900&family=Merriweather:wght@700;800;900&display=swap";

    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // =========================================================
  // INJECT UI POLISH STYLES (hover / focus states, purely visual)
  // =========================================================

  useEffect(() => {
    const style = document.createElement("style");

    style.textContent = `
      .wbg-input, .wbg-select {
        transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
      }
      .wbg-input:hover, .wbg-select:hover {
        border-color: #9ca3af;
      }
      .wbg-input:focus, .wbg-select:focus {
        border-color: ${BLUE};
        box-shadow: 0 0 0 3px rgba(27,62,140,0.12);
        outline: none;
      }
      .wbg-input::placeholder {
        color: #b0b7c3;
      }
      .wbg-guest-card {
        transition: box-shadow 0.18s ease, border-color 0.18s ease;
      }
      .wbg-guest-card:hover {
        border-color: #cbd5e1;
        box-shadow: 0 3px 10px rgba(15,23,42,0.07);
      }
      .wbg-color-wrap {
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .wbg-color-wrap:hover {
        transform: translateY(-1px);
        box-shadow: 0 3px 8px rgba(0,0,0,0.14);
      }
      .wbg-btn-dashed:hover {
        background: rgba(27,62,140,0.05);
      }
      .wbg-btn-outline:hover {
        background: #f3f4f6;
        border-color: #9ca3af;
      }
      .wbg-remove-btn:hover {
        background: rgba(239,68,68,0.1);
      }
      .wbg-stretch-input {
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .wbg-stretch-input:focus {
        border-color: ${BLUE};
        box-shadow: 0 0 0 2px rgba(27,62,140,0.1);
        outline: none;
      }
    `;

    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // =========================================================
  // UPDATE GUEST
  // =========================================================

  const updateGuest = (id, field, value) => {
    setGuests((currentGuests) =>
      currentGuests.map((guest) =>
        guest.id === id
          ? {
              ...guest,
              [field]: value,
            }
          : guest
      )
    );
  };

  // =========================================================
  // ADD GUEST
  // =========================================================

  const addGuest = () => {
    setGuests((currentGuests) => [
      ...currentGuests,
      {
        id: uid++,
        name: "",
        designation: "",
      },
    ]);
  };

  // =========================================================
  // REMOVE GUEST
  // =========================================================

  const removeGuest = (id) => {
    setGuests((currentGuests) =>
      currentGuests.length > 1
        ? currentGuests.filter((guest) => guest.id !== id)
        : currentGuests
    );
  };

  // =========================================================
  // RESET CUSTOMIZATION
  // =========================================================

  const resetCustomization = () => {
    setNameFontSize(90);
    setNameColor(ORANGE);
    setNameFontFamily(FONT_OPTIONS[0].value);

    setDesignationFontSize(65);
    setDesignationColor(BLUE);
    setDesignationFontFamily(FONT_OPTIONS[0].value);

    setCompanyFontSize(60);
    setCompanyColor(BLUE);
    setCompanyFontFamily(FONT_OPTIONS[0].value);
    setLineStretchPercent("company", 100);
  };

  // =========================================================
  // DOWNLOAD PDF
  // =========================================================

  const handleDownloadPdf = async () => {
    if (!boardRef.current) return;

    setIsExporting(true);

    try {
      // Wait for fonts to load
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // Small delay to make sure preview is fully rendered
      await new Promise((resolve) => setTimeout(resolve, 300));

      const canvas = await html2canvas(boardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: [PAGE_W_PT, PAGE_H_PT],
      });

      const imgRatio = canvas.width / canvas.height;
      const pageRatio = PAGE_W_PT / PAGE_H_PT;

      let drawW = PAGE_W_PT;
      let drawH = PAGE_H_PT;

      if (imgRatio > pageRatio) {
        drawH = PAGE_W_PT / imgRatio;
      } else {
        drawW = PAGE_H_PT * imgRatio;
      }

      const offsetX = (PAGE_W_PT - drawW) / 2;
      const offsetY = (PAGE_H_PT - drawH) / 2;

      pdf.addImage(
        imgData,
        "JPEG",
        offsetX,
        offsetY,
        drawW,
        drawH
      );

      // =====================================================
      // FILE NAME
      // =====================================================

      const mainGuest = guests.find(
        (guest) => guest.name.trim()
      )?.name?.trim();

      const safeName = mainGuest
        ? mainGuest.replace(/[^a-z0-9]+/gi, "_")
        : "welcome-board";

      pdf.save(`${safeName}.pdf`);
    } catch (error) {
      console.error("PDF generation failed:", error);

      alert(
        "Unable to generate PDF. Please try again."
      );
    } finally {
      setIsExporting(false);
    }
  };

  // =========================================================
  // RETURN UI
  // =========================================================

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#eef1f6",
        padding: "32px 20px",

        fontFamily:
          "'Barlow', -apple-system, BlinkMacSystemFont, sans-serif",

        display: "flex",
        flexDirection: "column",

        gap: 28,

        alignItems: "center",
      }}
    >

      {/* =====================================================
          MAIN CONTENT — stacked: form on top, preview below
      ===================================================== */}

      <div
        style={{
          width: "100%",
          maxWidth: 1200,

          display: "flex",
          flexDirection: "column",

          gap: 28,
        }}
      >
        {/* ===================================================
            FORM
        =================================================== */}

        <div
          style={{
            background: "#fff",

            borderRadius: 12,

            padding: 20,

            boxShadow:
              "0 1px 3px rgba(0,0,0,0.08)",

            display: "flex",
            flexDirection: "column",

            gap: 18,
          }}
        >
          {/* =================================================
              GUESTS
          ================================================= */}

          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,

                color: "#374151",

                marginBottom: 10,

                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: BLUE,
                  display: "inline-block",
                }}
              />
              Guests
            </div>

            <div
              style={{
                display: "flex",

                flexDirection: "column",

                gap: 14,
              }}
            >
              {guests.map((row, i) => (
                <div
                  key={row.id}
                  className="wbg-guest-card"
                  style={{
                    ...customizationSection,
                    borderLeft: `3px solid ${BLUE}`,
                    position: "relative",
                    marginBottom: 0,
                  }}
                >
                  {/* Guest number label — styled like a section title */}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: BLUE,
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </div>

                    <div style={sectionTitle}>
                      Guest {i + 1}
                    </div>
                  </div>

                  {/* SINGLE ROW — Name / Designation / Stretch */}

                  <div style={customRow}>
                    {/* NAME */}

                    <div style={{ flex: 1.3, minWidth: 160 }}>
                      <label style={smallLabel}>
                        Guest name
                      </label>

                      <input
                        className="wbg-input"
                        style={inputStyle}
                        value={row.name}
                        onChange={(e) =>
                          updateGuest(
                            row.id,
                            "name",
                            e.target.value
                          )
                        }
                        placeholder="Guest name"
                      />
                    </div>

                    {/* DESIGNATION */}

                    <div style={{ flex: 1.3, minWidth: 160 }}>
                      <label style={smallLabel}>
                        Designation
                      </label>

                      <input
                        className="wbg-input"
                        style={inputStyle}
                        value={row.designation}
                        onChange={(e) =>
                          updateGuest(
                            row.id,
                            "designation",
                            e.target.value
                          )
                        }
                        placeholder="Guest designation"
                      />
                    </div>

                    {/* STRETCH — applies to both this guest's lines */}

                    <div style={{ flex: 0.8, minWidth: 100 }}>
                      <label style={smallLabel}>
                        Stretch
                      </label>

                      <div style={stretchInputWrap}>
                        <input
                          className="wbg-stretch-input"
                          type="number"
                          min="40"
                          max="300"
                          step="5"
                          value={getGuestStretchPercent(row.id)}
                          onChange={(e) =>
                            setGuestStretchPercent(
                              row.id,
                              Number(e.target.value)
                            )
                          }
                          style={stretchInputStyle}
                        />
                        <span style={stretchSuffixStyle}>%</span>
                      </div>
                    </div>
                  </div>

                  {/* REMOVE */}

                  {guests.length > 1 && (
                    <button
                      type="button"
                      className="wbg-remove-btn"
                      onClick={() =>
                        removeGuest(row.id)
                      }
                      style={{
                        position: "absolute",

                        top: 10,
                        right: 10,

                        border: "none",

                        background:
                          "transparent",

                        color: "#ef4444",

                        cursor: "pointer",

                        fontSize: 12,

                        fontWeight: 700,

                        width: 22,
                        height: 22,
                        borderRadius: "50%",

                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* ADD GUEST */}

            <button
              type="button"
              className="wbg-btn-dashed"
              onClick={addGuest}
              style={{
                marginTop: 12,

                width: "100%",

                padding: "9px 0",

                borderRadius: 8,

                border: `1px dashed ${BLUE}`,

                color: BLUE,

                background: "transparent",

                fontWeight: 700,

                fontSize: 13,

                cursor: "pointer",
              }}
            >
              + Add Guest
            </button>
          </div>

          {/* =================================================
              COMPANY
          ================================================= */}

          <Field label="Company / Customer Name">
            <input
              className="wbg-input"
              style={inputStyle}
              value={companyName}
              onChange={(e) =>
                setCompanyName(e.target.value)
              }
              placeholder=""
            />
          </Field>

          {/* =================================================
              CUSTOMIZATION
          ================================================= */}

          <div
            style={{
              borderTop:
                "1px solid #e5e7eb",

              paddingTop: 16,
            }}
          >
            <div
              style={{
                fontSize: 13,

                fontWeight: 700,

                color: "#374151",

                marginBottom: 14,
              }}
            >
              Text Customization
            </div>

            {/* =================================================
                GUEST NAME CUSTOMIZATION
            ================================================= */}

            <div
              style={{
                ...customizationSection,
                borderLeft: `3px solid ${ORANGE}`,
              }}
            >
              <div
                style={sectionTitle}
              >
                Guest Name
              </div>

              <div
                style={customRow}
              >
                {/* FONT SIZE */}

                <div
                  style={{
                    flex: 1,
                  }}
                >
                  <label
                    style={smallLabel}
                  >
                    Font Size
                  </label>

                  <input
                    className="wbg-input"
                    type="number"
                    min="20"
                    max="150"
                    value={nameFontSize}
                    onChange={(e) =>
                      setNameFontSize(
                        Number(
                          e.target.value
                        )
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                {/* FONT STYLE */}

                <div
                  style={{
                    flex: 1.4,
                  }}
                >
                  <label style={smallLabel}>
                    Font Style
                  </label>

                  <select
                    className="wbg-select"
                    value={nameFontFamily}
                    onChange={(e) =>
                      setNameFontFamily(e.target.value)
                    }
                    style={selectStyle}
                  >
                    {FONT_OPTIONS.map((font) => (
                      <option
                        key={font.label}
                        value={font.value}
                      >
                        {font.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* COLOR */}

                <div>
                  <label
                    style={smallLabel}
                  >
                    Color
                  </label>

                  <div className="wbg-color-wrap" style={colorWrapStyle}>
                    <input
                      type="color"
                      value={nameColor}
                      onChange={(e) =>
                        setNameColor(
                          e.target.value
                        )
                      }
                      style={colorInputStyle}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* =================================================
                DESIGNATION CUSTOMIZATION
            ================================================= */}

            <div
              style={{
                ...customizationSection,
                borderLeft: `3px solid ${BLUE}`,
              }}
            >
              <div
                style={sectionTitle}
              >
                Designation
              </div>

              <div
                style={customRow}
              >
                {/* FONT SIZE */}

                <div
                  style={{
                    flex: 1,
                  }}
                >
                  <label
                    style={smallLabel}
                  >
                    Font Size
                  </label>

                  <input
                    className="wbg-input"
                    type="number"
                    min="20"
                    max="120"
                    value={
                      designationFontSize
                    }
                    onChange={(e) =>
                      setDesignationFontSize(
                        Number(
                          e.target.value
                        )
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                {/* FONT STYLE */}

                <div
                  style={{
                    flex: 1.4,
                  }}
                >
                  <label style={smallLabel}>
                    Font Style
                  </label>

                  <select
                    className="wbg-select"
                    value={designationFontFamily}
                    onChange={(e) =>
                      setDesignationFontFamily(
                        e.target.value
                      )
                    }
                    style={selectStyle}
                  >
                    {FONT_OPTIONS.map((font) => (
                      <option
                        key={font.label}
                        value={font.value}
                      >
                        {font.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* COLOR */}

                <div>
                  <label
                    style={smallLabel}
                  >
                    Color
                  </label>

                  <div className="wbg-color-wrap" style={colorWrapStyle}>
                    <input
                      type="color"
                      value={
                        designationColor
                      }
                      onChange={(e) =>
                        setDesignationColor(
                          e.target.value
                        )
                      }
                      style={colorInputStyle}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* =================================================
                COMPANY CUSTOMIZATION
            ================================================= */}

            <div
              style={{
                ...customizationSection,
                borderLeft: `3px solid ${BLUE}`,
              }}
            >
              <div
                style={sectionTitle}
              >
                Company / University
              </div>

              <div
                style={customRow}
              >
                {/* FONT SIZE */}

                <div
                  style={{
                    flex: 1,
                  }}
                >
                  <label
                    style={smallLabel}
                  >
                    Font Size
                  </label>

                  <input
                    className="wbg-input"
                    type="number"
                    min="20"
                    max="120"
                    value={companyFontSize}
                    onChange={(e) =>
                      setCompanyFontSize(
                        Number(
                          e.target.value
                        )
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                {/* FONT STYLE */}

                <div
                  style={{
                    flex: 1.4,
                  }}
                >
                  <label style={smallLabel}>
                    Font Style
                  </label>

                  <select
                    className="wbg-select"
                    value={companyFontFamily}
                    onChange={(e) =>
                      setCompanyFontFamily(e.target.value)
                    }
                    style={selectStyle}
                  >
                    {FONT_OPTIONS.map((font) => (
                      <option
                        key={font.label}
                        value={font.value}
                      >
                        {font.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* COLOR */}

                <div>
                  <label
                    style={smallLabel}
                  >
                    Color
                  </label>

                  <div className="wbg-color-wrap" style={colorWrapStyle}>
                    <input
                      type="color"
                      value={companyColor}
                      onChange={(e) =>
                        setCompanyColor(
                          e.target.value
                        )
                      }
                      style={colorInputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* STRETCH (width) — dedicated control for the company line */}

              {/* <div
                style={{
                  marginTop: 12,
                  background: "#f9fafb",
                  border: "1px solid #eef0f3",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 8,
                  }}
                >
                  Width tuning
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      minWidth: 90,
                    }}
                  >
                    <label style={smallLabel}>
                      Stretch
                    </label>

                    <div style={stretchInputWrap}>
                      <input
                        className="wbg-stretch-input"
                        type="number"
                        min="40"
                        max="300"
                        step="5"
                        value={getLineStretchPercent("company")}
                        onChange={(e) =>
                          setLineStretchPercent(
                            "company",
                            Number(e.target.value)
                          )
                        }
                        style={stretchInputStyle}
                      />
                      <span style={stretchSuffixStyle}>%</span>
                    </div>
                  </div>

                  <div
                    style={{
                      flex: 2,
                      minWidth: 140,
                    }}
                  >
                    <input
                      type="range"
                      min="40"
                      max="300"
                      step="5"
                      value={getLineStretchPercent("company")}
                      onChange={(e) =>
                        setLineStretchPercent(
                          "company",
                          Number(e.target.value)
                        )
                      }
                      style={{
                        width: "100%",
                        cursor: "pointer",
                        accentColor: BLUE,
                      }}
                    />
                  </div>
                </div>
              </div> */}
            </div>

            {/* =================================================
                RESET
            ================================================= */}

            <button
              type="button"
              className="wbg-btn-outline"
              onClick={resetCustomization}
              style={resetButtonStyle}
            >
              Reset Customization
            </button>
          </div>

          {/* =================================================
              DOWNLOAD
          ================================================= */}

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExporting}
            style={{
              marginTop: 4,

              width: "100%",

              padding: "12px 0",

              borderRadius: 8,

              border: "none",

              background: isExporting
                ? "#93a5c9"
                : BLUE,

              color: "#fff",

              fontWeight: 700,

              fontSize: 14,

              cursor: isExporting
                ? "default"
                : "pointer",

              transition:
                "0.2s ease",
            }}
          >
            {isExporting
              ? "Generating PDF…"
              : "⬇ Download PDF"}
          </button>
        </div>

        {/* ===================================================
            PREVIEW (now full width, below the form)
        =================================================== */}

        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#374151",
                }}
              >
                Live Preview
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#9ca3af",
                  marginTop: 2,
                }}
              >
                Drag any line to nudge its position, or drag its ⇔ handle to stretch its width.
              </div>
            </div>

            <button
              type="button"
              className="wbg-btn-outline"
              onClick={resetPositions}
              style={{
                padding: "8px 14px",
                borderRadius: 7,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#4b5563",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reset Position &amp; Stretch
            </button>
          </div>

          <BoardPreview
            boardRef={boardRef}
            guests={guests}
            companyName={companyName}
            nameFontSize={nameFontSize}
            nameColor={nameColor}
            nameFontFamily={nameFontFamily}
            designationFontSize={
              designationFontSize
            }
            designationColor={
              designationColor
            }
            designationFontFamily={designationFontFamily}
            companyFontSize={companyFontSize}
            companyColor={companyColor}
            companyFontFamily={companyFontFamily}
            linePositions={linePositions}
            onLineDrag={updateLinePosition}
            lineScales={lineScales}
            onLineStretch={updateLineScale}
          />
        </div>
      </div>
    </div>
  );
}

// =============================================================
// FIELD COMPONENT
// =============================================================

function Field({
  label,
  children,
  small,
}) {
  return (
    <label
      style={{
        display: "block",
      }}
    >
      <div
        style={{
          fontSize: small
            ? 11
            : 12,

          fontWeight: 600,

          color: "#6b7280",

          marginBottom: 5,
        }}
      >
        {label}
      </div>

      {children}
    </label>
  );
}

// =============================================================
// INPUT STYLE
// =============================================================

const inputStyle = {
  width: "100%",

  boxSizing: "border-box",

  padding: "9px 11px",

  borderRadius: 7,

  border:
    "1px solid #d1d5db",

  fontSize: 14,

  fontFamily: "inherit",

  outline: "none",

  background: "#fff",

  // Make the text and blinking caret clearly visible on the white field
  color: "#111827",
  caretColor: "#111827",
};

// =============================================================
// STRETCH INPUT (with % suffix) STYLES
// =============================================================

const stretchInputWrap = {
  position: "relative",
};

const stretchInputStyle = {
  ...inputStyle,
  padding: "7px 26px 7px 9px",
  fontSize: 13,
};

const stretchSuffixStyle = {
  position: "absolute",
  right: 9,
  top: "50%",
  transform: "translateY(-50%)",
  fontSize: 12,
  fontWeight: 600,
  color: "#9ca3af",
  pointerEvents: "none",
};

// =============================================================
// SELECT STYLE (font style dropdown)
// =============================================================

const selectStyle = {
  ...inputStyle,
  cursor: "pointer",
};

// =============================================================
// CUSTOMIZATION STYLES
// =============================================================

const customizationSection = {
  marginBottom: 16,

  padding: 12,

  border:
    "1px solid #e5e7eb",

  borderRadius: 8,

  background: "#f9fafb",
};

const sectionTitle = {
  fontSize: 12,

  fontWeight: 700,

  color: "#374151",

  marginBottom: 10,
};

const customRow = {
  display: "flex",

  alignItems: "flex-end",

  gap: 12,

  flexWrap: "wrap",
};

const smallLabel = {
  display: "block",

  fontSize: 11,

  fontWeight: 600,

  color: "#6b7280",

  marginBottom: 5,
};

const colorWrapStyle = {
  display: "inline-flex",
  borderRadius: 9,
  overflow: "hidden",
  border: "1px solid #d1d5db",
  background: "#fff",
};

const colorInputStyle = {
  width: 48,

  height: 38,

  padding: 3,

  border: "none",

  cursor: "pointer",

  background: "#fff",
};

const resetButtonStyle = {
  width: "100%",

  padding: "9px 0",

  borderRadius: 7,

  border:
    "1px solid #d1d5db",

  background: "#fff",

  color: "#4b5563",

  fontSize: 12,

  fontWeight: 600,

  cursor: "pointer",
};

// =============================================================
// DRAGGABLE LINE — wraps each text row so it can be repositioned
// =============================================================

function DraggableLine({ id, onDrag, style, children }) {
  const draggingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastPointRef.current.x;
    const dy = e.clientY - lastPointRef.current.y;
    lastPointRef.current = { x: e.clientX, y: e.clientY };
    onDrag(id, dx, dy);
  };

  const handlePointerUp = () => {
    draggingRef.current = false;
    document.removeEventListener("pointermove", handlePointerMove);
    document.removeEventListener("pointerup", handlePointerUp);
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    lastPointRef.current = { x: e.clientX, y: e.clientY };
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      style={{
        ...style,
       cursor: "move",
        userSelect: "none",
        touchAction: "none",
      }}
      title="Drag to reposition"
    >
      {children}
    </div>
  );
}

// =============================================================
// STRETCH HANDLE — drag left/right to widen or narrow a line
// =============================================================

function StretchHandle({ id, onStretch, stretch }) {
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastXRef.current;
    lastXRef.current = e.clientX;
    onStretch(id, dx / 200);
  };

  const handlePointerUp = () => {
    draggingRef.current = false;
    document.removeEventListener("pointermove", handlePointerMove);
    document.removeEventListener("pointerup", handlePointerUp);
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    lastXRef.current = e.clientX;
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      // Keep this UI-only grip out of the exported board image
      data-html2canvas-ignore="true"
      title="Drag to stretch width"
      style={{
        position: "absolute",
        right: "-1.6cqw",
        top: "50%",
        // Cancel out the parent's horizontal stretch so the grip
        // stays a normal circle instead of stretching with the text.
        transform: `translateY(-50%) scaleX(${1 / stretch})`,

        width: "2.2cqw",
        height: "2.2cqw",
        minWidth: 18,
        minHeight: 18,

        display: "flex",
        alignItems: "center",
        justifyContent: "center",

        borderRadius: "50%",
        border: `1.5px solid ${BLUE}`,
        background: "#ffffff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.35)",

        cursor: "ew-resize",
        userSelect: "none",
        touchAction: "none",

        color: BLUE,
        fontWeight: 700,
        fontSize: "1.3cqw",
        lineHeight: 1,
        zIndex: 5,
      }}
    >
      ⇔
    </div>
  );
}

// =============================================================
// BOARD PREVIEW
// =============================================================

function BoardPreview({
  boardRef,
  guests,
  companyName,
  nameFontSize,
  nameColor,
  nameFontFamily,
  designationFontSize,
  designationColor,
  designationFontFamily,
  companyFontSize,
  companyColor,
  companyFontFamily,
  linePositions,
  onLineDrag,
  lineScales,
  onLineStretch,
}) {
  const lines = [];

  guests.forEach((guest) => {
    if (guest.name.trim()) {
      lines.push({
        key: `name-${guest.id}`,
        text: guest.name.trim(),
        size: nameFontSize,
        color: nameColor,
        family: nameFontFamily,
        type: "name",
      });
    }

    if (guest.designation.trim()) {
      lines.push({
        key: `designation-${guest.id}`,
        text: guest.designation.trim(),
        size: designationFontSize,
        color: designationColor,
        family: designationFontFamily,
        type: "designation",
      });
    }
  });

  if (companyName.trim()) {
    lines.push({
      key: "company",
      text: companyName.trim(),
      size: companyFontSize,
      color: companyColor,
      family: companyFontFamily,
      type: "company",
    });
  }

  /*
   * Reduce the font size automatically when there are many lines.
   * This prevents guests from overlapping each other.
   */
  const lineCount = lines.length;

  let scaleFactor = 1;

  if (lineCount >= 7) {
    scaleFactor = 0.65;
  } else if (lineCount === 6) {
    scaleFactor = 0.72;
  } else if (lineCount === 5) {
    scaleFactor = 0.80;
  } else if (lineCount === 4) {
    scaleFactor = 0.88;
  } else if (lineCount === 3) {
    scaleFactor = 0.94;
  }

  return (
    <div
      ref={boardRef}
      style={{
        width: "100%",
        aspectRatio: `${IMG_W} / ${IMG_H}`,
        containerType: "inline-size",
        position: "relative",

        backgroundImage: `url(welcome-board-template.png)`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",

        borderRadius: "0.4cqw",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",

          /*
           * Give the text a larger safe area.
           */
          top: "30%",
          bottom: "11%",
          left: "7%",
          right: "7%",

          display: "flex",
          flexDirection: "column",

          justifyContent: "center",
          alignItems: "center",

          /*
           * Smaller gap prevents excessive spacing.
           */
          gap: "0.45cqw",

          // Was "hidden" — that silently clipped stretched text so it
          // looked like nothing happened. The outer board div above
          // still clips at the true poster edges.
          overflow: "visible",
        }}
      >
        {lines.map((line) => {
          const finalFontSize =
            line.size * scaleFactor;

          const position =
            linePositions[line.key] || { x: 0, y: 0 };

          const stretch = lineScales[line.key] ?? 1;

          return (
            <div
              key={line.key}
              style={{
                position: "relative",
                display: "inline-block",
                maxWidth: "100%",

                // Moving translate+scaleX here (instead of on just the text)
                // means the handle, positioned relative to this box, moves
                // and widens its offset proportionally as the text stretches
                // — instead of staying put while the text grows past it.
                transform: `translate(${position.x}px, ${position.y}px) scaleX(${stretch})`,
                transformOrigin: "center",
              }}
            >
              <DraggableLine
                id={line.key}
                onDrag={onLineDrag}
                style={{
                  fontFamily: line.family,

                  fontWeight: 800,

                  /*
                   * Convert points to cqw.
                   */
                  fontSize:
                    `${(finalFontSize / PAGE_W_PT) * 100}cqw`,

                  color: line.color,

                  lineHeight:
                    line.type === "name"
                      ? 1.0
                      : 1.05,

                  textAlign: "center",

                  /*
                   * Allow long text to wrap instead
                   * of going outside the board.
                   */
                  whiteSpace: "normal",

                  overflowWrap: "break-word",

                  maxWidth: "100%",

                  flexShrink: 1,

                  margin: 0,
                }}
              >
                {line.text}
              </DraggableLine>

              <StretchHandle
                id={line.key}
                onStretch={onLineStretch}
                stretch={stretch}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}