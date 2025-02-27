import { Canvas } from '@react-three/fiber'
import {
  Container,
  Fullscreen,
  DefaultProperties,
  Text,
  SvgIconFromText,
  setPreferredColorScheme,
  canvasInputProps,
} from '@react-three/uikit'
import { Defaults, colors } from '@/theme.js'
import { Button } from '@/button.js'
import { UserAuthForm } from './components/user-auth-form'

setPreferredColorScheme('light')

export default function App() {
  return (
    <Canvas
      flat
      camera={{ position: [0, 0, 18], fov: 35 }}
      style={{ height: '100dvh', touchAction: 'none' }}
      gl={{ localClippingEnabled: true }}
      {...canvasInputProps}
    >
      {/*<Root backgroundColor={0xffffff} sizeX={8.34} sizeY={5.58} pixelSize={0.01}>
        <Defaults>
          <DialogAnchor>
            <MarketPage />
          </DialogAnchor>
        </Defaults>
      </Root>
      <Environment background blur={1} preset="city" />
      <EffectComposer>
        <TiltShift2 blur={0.25} />
      </EffectComposer>
      <OrbitControls makeDefault />*/}
      <Fullscreen backgroundColor={colors.background}>
        <Defaults>
          <DefaultProperties scrollbarWidth={8} scrollbarOpacity={0.1} scrollbarBorderRadius={4}>
            <AuthenticationPage />
          </DefaultProperties>
        </Defaults>
      </Fullscreen>
    </Canvas>
  )
}

function AuthenticationPage() {
  return (
    <Container height="100%" positionType="relative" flexDirection="row" alignItems="center">
      <Button
        variant="ghost"
        positionType="absolute"
        positionRight={16}
        positionTop={16}
        md={{ positionRight: 32, positionTop: 32 }}
      >
        <Text>Login</Text>
      </Button>
      <Container
        positionType="relative"
        flexGrow={1}
        flexBasis={0}
        maxWidth={0}
        overflow="hidden"
        height="100%"
        flexDirection="column"
        dark={{ borderRight: 1 }}
        padding={0}
        lg={{ padding: 40, maxWidth: 10000 }}
        backgroundColor={0x18181b}
      >
        <DefaultProperties color="white">
          <Container flexDirection="row" alignItems="center">
            <SvgIconFromText
              text={`<svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2 h-6 w-6"
            >
              <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
            </svg>`}
              svgHeight={24}
              svgWidth={24}
              width={24}
              height={24}
              marginRight={8}
            />

            <Text fontSize={18} lineHeight={1.5555} fontWeight="medium">
              Acme Inc
            </Text>
          </Container>
          <Container marginTop="auto">
            <Container gap={8}>
              <Text fontSize={18} lineHeight={1.555}>
                "Culpa eiusmod ut ipsum sunt velit labore minim eu. Occaecat magna mollit aliqua cupidatat."
              </Text>
              <Text fontSize={14} lineHeight={1.43}>
                Max Mustermann
              </Text>
            </Container>
          </Container>
        </DefaultProperties>
      </Container>
      <Container flexBasis={0} flexGrow={1} padding={16} lg={{ padding: 32 }}>
        <Container marginX="auto" width="100%" justifyContent="center" gap={24} sm={{ width: 350 }}>
          <Container gap={8}>
            <DefaultProperties horizontalAlign="center">
              <Text fontSize={24} lineHeight={1.3333} fontWeight="semi-bold" letterSpacing={-0.4}>
                Create an account
              </Text>
              <Text fontSize={14} lineHeight={1.43} color={colors.mutedForeground}>
                Enter your email below to create your account
              </Text>
            </DefaultProperties>
          </Container>
          <UserAuthForm />
          <Text paddingX={32} horizontalAlign="center" fontSize={14} lineHeight={1.43} color={colors.mutedForeground}>
            By clicking continue, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </Container>
      </Container>
    </Container>
  )
}
