#define nop andeq r0, r0

.text

b resetBase
b undefBase
b swiBase
b pabtBase
b dabtBase
nop
b irqBase
b fiqBase

resetBase:
mov pc, #0x8000000

irqBase:
stmfd  sp!, {r0-r3, r12, lr}
mov    r0, #0x3000000
orr    r0, #0x8000
add    lr, pc, #0 
ldr    pc, [r0, #-4]
ldmfd  sp!, {r0-r3, r12, lr}
subs   pc, lr, #4
