import React from 'react';
import styled from 'styled-components';

/* Brand loader: MPI mark on a glass tile, orbited by a conic ring.
   Markup/CSS is mirrored 1:1 in index.html (#pre-loader-overlay) so the
   hand-off from the static pre-mount loader to React is seamless. */
const Loader = () => {
  return (
    <StyledWrapper>
      <div aria-label="Loading" role="img" className="mpi-loader">
        <div className="mpi-loader__ring" />
        <div className="mpi-loader__tile">
          <img src="Logo.png" alt="" />
        </div>
        <div className="mpi-loader__bar"><span /></div>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .mpi-loader {
    position: relative;
    width: 132px;
    height: 132px;
    display: grid;
    place-items: center;
  }

  .mpi-loader__ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: conic-gradient(from 0deg, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.9) 300deg, rgba(255,255,255,0) 360deg);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
            mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
    animation: mpiSpin 1.1s linear infinite;
    will-change: transform;
  }

  .mpi-loader__tile {
    width: 92px;
    height: 92px;
    border-radius: 24px;
    display: grid;
    place-items: center;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 1px 0 rgba(255,255,255,0.6) inset, 0 20px 40px -12px rgba(0, 0, 0, 0.45);
    animation: mpiBreathe 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    will-change: transform;
  }
  .mpi-loader__tile img {
    width: 68px;
    height: auto;
    object-fit: contain;
  }

  .mpi-loader__bar {
    position: absolute;
    bottom: -28px;
    width: 96px;
    height: 3px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.22);
    overflow: hidden;
  }
  .mpi-loader__bar span {
    display: block;
    width: 40%;
    height: 100%;
    border-radius: 3px;
    background: #ffffff;
    animation: mpiSweep 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    will-change: transform;
  }

  @keyframes mpiSpin { to { transform: rotate(360deg); } }
  @keyframes mpiBreathe {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.04); }
  }
  @keyframes mpiSweep {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(250%); }
  }

  @media (prefers-reduced-motion: reduce) {
    .mpi-loader__ring, .mpi-loader__tile, .mpi-loader__bar span { animation-duration: 3s; }
  }
`;

export default Loader;