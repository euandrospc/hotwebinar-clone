// Source: https://github.com/tremorlabs/tremor/blob/ca4d588f47820ff3d514d37fa4ee08a4222dec11/src/hooks/useOnWindowResize.ts
// Local adaptations are documented in README.md; upstream MIT license in LICENSE.
// Tremor useOnWindowResize [v0.0.2]

import * as React from "react"

export const useOnWindowResize = (handler: () => void) => {
  React.useEffect(() => {
    const handleResize = () => {
      handler()
    }
    handleResize()
    window.addEventListener("resize", handleResize)

    return () => window.removeEventListener("resize", handleResize)
  }, [handler])
}
