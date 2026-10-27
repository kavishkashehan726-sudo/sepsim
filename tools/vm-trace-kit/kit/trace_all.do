# SEPSim trace kit: records every SEP signal, every half clock, for each test program.
# Started by run_traces.bat as:  vsim -c -do "set sepdir {...}; do trace_all.do"
# (run_probe.bat also sets "probe 1": one short program into out_probe, for a quick check)
# It drives the model the same way SEPSim Beta does: force the architecture,
# force a 50 ns clock, load the .mem into /processor/as_ram/asram, then run.
#
# Signals are captured two independent ways, so one failing does not lose the run:
#   <name>.vcd    ModelSim VCD dump of every signal (vcd add -r)
#   <name>.trace  per-half-clock examine of every signal, changes only (includes enum states)
# (ModelSim 6.1e examine has no -radix option; pick_examine falls back to -binary.)

onerror {resume}
transcript file trace_transcript.log
# The SEP divider warns about undefined inputs on every evaluation; printing
# thousands of these slows the run down badly, so silence the library warnings.
quietly set StdArithNoWarnings 1
quietly set NumericStdNoWarnings 1

if {![info exists probe]} { quietly set probe 0 }
quietly set kitdir [pwd]
quietly set outdir [file join $kitdir [expr {$probe ? "out_probe" : "out"}]]
file mkdir $outdir
quietly set errlog [open [file join $outdir errors.txt] a]

proc note {msg} {
    global errlog
    puts $errlog $msg
    flush $errlog
    echo $msg
}

proc load_design {} {
    global sepdir
    set workdir [file join $sepdir work]
    if {[catch {vmap sep $workdir} msg]} {
        error "could not map SEP library at $workdir: $msg"
    }
    vsim -quiet sep.processor
}

proc signal_list {name} {
    global sepdir
    foreach cmd {
        {find signals -recursive /processor/*}
        {find signals -r /processor/*}
        {find signals /processor/*}
    } {
        if {[catch {uplevel #0 $cmd} sigs]} {
            note "$name: '$cmd' failed: $sigs"
        } elseif {[llength $sigs] > 0} {
            return $sigs
        }
    }
    # Fallback: the list SEPSim itself uses
    set sigs {}
    set f [open [file join $sepdir Signals.ini] r]
    while {[gets $f line] >= 0} {
        if {[regexp {^[0-9]+=(.+)$} [string trim $line] -> s]} { lappend sigs $s }
    }
    close $f
    return $sigs
}

# Pick the first examine form that works on the clock signal, remember it.
proc pick_examine {name} {
    foreach form {
        {examine -radix binary}
        {examine -binary}
        {examine -radix bin}
        {examine}
    } {
        set cmd $form
        lappend cmd /processor/clk
        if {[catch {uplevel #0 $cmd} v]} {
            note "$name: '$form /processor/clk' failed: $v"
        } else {
            note "$name: using '$form' (clk = $v)"
            return $form
        }
    }
    return ""
}

proc sample {form sigs} {
    if {$form eq ""} {
        set vals {}
        foreach s $sigs { lappend vals "?" }
        return $vals
    }
    set cmd $form
    foreach s $sigs { lappend cmd $s }
    if {![catch {uplevel #0 $cmd} vals] && [llength $vals] == [llength $sigs]} {
        return $vals
    }
    set vals {}
    foreach s $sigs {
        set cmd $form
        lappend cmd $s
        if {[catch {uplevel #0 $cmd} v]} { set v "?" }
        lappend vals $v
    }
    return $vals
}

proc trace_one {name memfile machine clocks} {
    global outdir
    # A program is finished once its RAM dump exists; skip it on a re-run.
    if {[file exists [file join $outdir $name.ram.mem]]} {
        echo "=== $name already recorded, skipping"
        return
    }
    load_design
    force -deposit /processor/machine $machine
    force -freeze /processor/clk 1 0, 0 {25 ns} -r 50 ns

    if {[catch {
        vcd file [file join $outdir $name.vcd]
        vcd add -r /processor/*
    } msg]} { note "$name: vcd failed: $msg" }

    run 0 ns
    mem load -format bin -infile $memfile -filldata 0000000000000000 /processor/as_ram/asram

    set sigs [signal_list $name]
    set form [pick_examine $name]
    set f [open [file join $outdir $name.trace] w]
    puts $f "# sepsim-trace v2"
    puts $f "program $name"
    puts $f "machine $machine"
    set i 0
    foreach s $sigs { puts $f "signal $i $s"; incr i }

    set prev [sample $form $sigs]
    puts $f "t 0"
    set i 0
    foreach v $prev { puts $f "v $i $v"; incr i }
    flush $f

    for {set c 1} {$c <= 2 * $clocks} {incr c} {
        run 25 ns
        set cur [sample $form $sigs]
        puts $f "t [expr {$c * 25}]"
        set i 0
        foreach v $cur p $prev {
            if {$v ne $p} { puts $f "v $i $v" }
            incr i
        }
        set prev $cur
        flush $f
    }
    close $f
    catch {vcd flush}
    catch {mem save -outfile [file join $outdir $name.cache.mem] -format bin -wordsperline 20 /processor/cache/storage}
    catch {mem save -outfile [file join $outdir $name.ram.mem] -format bin -wordsperline 20 /processor/as_ram/asram}
    quit -sim
}

quietly set mf [open [file join $kitdir manifest.txt] r]
while {[gets $mf line] >= 0} {
    set line [string trim $line]
    if {$line eq "" || [string index $line 0] eq "#"} continue
    foreach {name machine clocks} $line break
    if {$probe} { set clocks 40 }
    set memfile [file join $kitdir mem $name.mem]
    echo "=== tracing $name (machine $machine, $clocks clocks)"
    if {[catch {trace_one $name $memfile $machine $clocks} err]} {
        note "$name: $err"
        catch {quit -sim}
    }
    if {$probe} break
}
close $mf

# Any extra .mem files the user drops into the extra folder (traced as Accumulator)
if {!$probe} {
    foreach memfile [glob -nocomplain [file join $kitdir extra *.mem]] {
        set name "extra_[file rootname [file tail $memfile]]"
        echo "=== tracing $name"
        if {[catch {trace_one $name $memfile 101 400} err]} {
            note "$name: $err"
            catch {quit -sim}
        }
    }
}

close $errlog
echo "=== all done"
quit -f
